#!/bin/bash

last_ddl_update_time=0
last_ddl_commit_time=0

# tables_to_update: a list of tables to update
tables_to_update=()

# create_glue_database
#
# $1 -> name
# $2 -> env
create_glue_database() {
  db="${2}_${1}"
  
  # Otherwise, make sure user has a Glue Database, else create one.
  output=$(aws glue get-database --name ${db} 2>&1 > /dev/null)
  result=$?

  if [[ 0 -ne ${result} ]]; then
    echo `date` "Creating database ${db}".
    aws glue create-database --database-input Name=${db}
  fi
}

# get_last_ddl_commit_time
#
# Finds the most recent time that a DDL file for a table has been committed
get_last_ddl_commit_time() {
  for ddl_file in $(find . -name "*.ddl" | sort); do
    time=$(git log -1 --format=%cd \
            --date=raw ${ddl_file} \
            | awk '{ print $1 }')
    if [[ ${last_ddl_commit_time} < ${time} ]]; then
      last_ddl_commit_time=${time}
    fi
  done

  echo ${last_ddl_commit_time}
}

# find_tables_to_update
#
# $1 -> location
find_tables_to_update() {
  # Loop over all the directories...
  for dir in $(find . -type d -exec sh -c '(ls -p "{}"|grep />/dev/null)||echo "{}"' \; | cut -c 3-); do

    # Get current directory location so we can get back here later
    initial_dir=$(pwd)

    # if table contains a slash,
    # then actual table name is lowest level leaf dir
    if [[ "${dir}" == *\/* ]]; then
      table=${dir##*/}
    else
      table=${dir}
    fi

    # Get last time DDL was updated
    last_ddl_update_time=$(get_last_ddl_update_time ${table})
    # if there is no ddl update time, then we need to update it!
    # set last update time to zero so we apply ddl
    if [[ 0 -eq ${last_ddl_update_time} ]]; then
      tables_to_update+=(${dir})
      continue
    fi

    # look at all DDL files for the table, finding the last time any
    # commits were made to these files.
    cd ${dir}
    last_ddl_commit_time=$(get_last_ddl_commit_time)
    # if we have commits more recently than the ddl was updated, then
    # we need to update the ddl on this table
    if [[ ${last_ddl_update_time} < ${last_ddl_commit_time} ]]; then
      tables_to_update+=(${dir})
    fi
    cd ${initial_dir}
  done
}

# apply_tables_to_update
#
# Applies DDL for those tables which need an update
# $1 -> layer
apply_tables_to_update() {
  for dir in ${tables_to_update[@]}; do
    initial_dir=$(pwd)
    cd ${dir}
    echo `date` "Updating ${dir##*/}..."
    calling_arn=`aws sts get-caller-identity | jq '.Arn' | sed 's|\"||g'`
    
    principal=$( jq -n \
                  --arg ca "${calling_arn}}" \
                  '{DataLakePrincipalIdentifier: $ca}' )

    resource=$( jq -n \
                  --arg db "${db}" \
                  --arg nm "${dir}" \
                  '{Table: { DatabaseName:$db, Name: $nm }}' )

    output=$(aws lakeformation grant-permissions --principal "$principal" --resource "$resource" --permissions '["ALTER", "DELETE", "DROP", "INSERT"]')
    result=$?

    for ddl_file in $(find . -name "*.ddl" | sort); do
      ddl=$(< ${ddl_file})
      echo `date` "Executing DDL in ${ddl_file}... "
      run_athena_query "${ddl}" ${dir}
      echo `date` "Done."
    done
    echo `date` "Completed updates to ${dir##*/}"
    cd ${initial_dir}
  done
}

print_tables_to_update() {
  echo "Tables which need updates:"
  for table in ${tables_to_update[@]}; do
    echo -e "\t${table}"
  done
}

# get_last_ddl_update_time
#
# Determines last time DDL was updated on a table by querying AWS Glue
# $2 -> table
get_last_ddl_update_time() {
  output=$(aws glue get-table \
            --database "${db}" \
            --name "${1}" \
            --query 'Table.Parameters.transient_lastDdlTime' \
            --output text )
  result=$?

  # if we have non-zero exit code, treat as table doesn't exist by returning 0
  # else, return the last ddl time we got from the output
  if [[ 0 -ne ${result} ]]; then
    echo 0
  else
    echo ${output}
  fi
}

run_athena_query() {
  location="${datalake_bucket}/${2}/"
  query=$(echo ${1} | sed 's|${LOCATION}|'"${location}"'|g')
  # echo ${query}
  query_id=$(aws athena start-query-execution \
              --query-string "${query}" \
              --query-execution-context Database=${db} \
              --result-configuration OutputLocation=${logs_bucket} \
              --query 'QueryExecutionId' \
              --output text)

  query_state=$(aws athena get-query-execution \
              --query-execution-id ${query_id} \
              --query 'QueryExecution.Status.State' \
              --output text)

  while [ RUNNING == ${query_state} ] || [ SUBMITTED == ${query_state} ] || [ QUEUED == ${query_state} ]; do
    query_state=$(aws athena get-query-execution \
                --query-execution-id ${query_id} \
                --query 'QueryExecution.Status.State' \
                --output text)
  done

  if [[ SUCCEEDED != $query_state ]]; then
    echo ${query_state}
    echo `date` "DDL execution failed. Exiting!"
    exit 1
  fi
}

usage () {
  echo ""
  echo "./deploy.sh -e env -d database name"
  echo "    -e: Environment name to deploy (dev, qa, staging, prod)."
  echo "        (NOTE: staging raw data layer will use prod S3 for location)"
  echo "    -h: print this help message"
  echo "    -l: Athena logs bucket"
  echo "    -n: Database name"
  echo "    -b: S3 data bucket"
  echo "    -o: Glue Database Table Owner Role ARN"
}

while getopts b:l:e:d:w:uh opt; do
  case ${opt} in
    b) datalake_bucket=${OPTARG};;
    d) database=${OPTARG};;
    e) env=${OPTARG};;
    l) logs_bucket=${OPTARG};;
    o) onwer=${OPTARG};;
    w) working_directory=${OPTARG};;
    h)
      usage
      exit 0
      ;;  
    \?)
      exit 1
      ;;
    :)
      usage
      exit 1
      ;;
  esac
done

# env and database name are required parameters, if not set, exit
if [[ -z ${env} ]]; then
  echo `date` "Environment is required parameter (i.e. prod, test, dev)."
  usage
  exit 1
fi

if [[ -z ${database} ]]; then
  echo `date` "Database name is required parameter (i.e. datalake, database)."
  usage
  exit 1
fi

if [[ -z ${working_directory} ]]; then
  echo `date` "Working directory is required parameter."
  usage
  exit 1
fi

cd ${working_directory}
create_glue_database ${database} ${env}

echo `date` "Beginning DDL deploy process for env ${env}"
find_tables_to_update 
print_tables_to_update
apply_tables_to_update
echo `date` "DDL deploy process complete for env ${env}"