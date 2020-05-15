#!/usr/bin/python

import sys, getopt, json
import boto3

glue = boto3.client('glue')
s3 = boto3.client('s3')

def main(argv):
    try:
        opts, args = getopt.getopt(argv,"hb:p:a:d:t:",["bucket=","prefix=","account_id=","database_name=","table_name="])
    except getopt.GetoptError:
        print('partition-update.py -b <bucket> -p <prefix> -a <account_id> -d <database_name> -t <table_name>')
        sys.exit(2)
    for opt, arg in opts:
        if opt == '-h':
            print('partition-update.py -b <bucket> -p <prefix> -a <account_id> -d <database_name> -t <table_name>')
            sys.exit()
        elif opt in ("-b", "--bucket"):
            bucket = arg
        elif opt in ("-p", "--prefix"):
            prefix = arg
        elif opt in ("-a", "--account_id"):
            account_id = arg
        elif opt in ("-d", "--database_name"):
            database_name = arg
        elif opt in ("-t", "--table_name"):
            table_name = arg                                    
        
    bucket = bucket[5:-1]
    
    response = s3.list_objects_v2(
        Bucket=bucket,
        Prefix=prefix
    )

    location = 's3://{0}/{1}'.format(bucket,prefix)

    # Load the table created above to get the StorageDescriptor def for columns, etc.
    streaming_table = glue.get_table(
        CatalogId=account_id,
        DatabaseName=database_name,
        Name=table_name
    )

    storage_descriptor= streaming_table['Table']['StorageDescriptor']

    # De-dupe partitions if there are any
    partitions = set()
    for obj in response['Contents']:
        # remove the first prefix for the table data lake location above and the last entry for the file
        keys =  obj['Key'].split('/')[1:-1]
        # get the values of the prefixes in between. These are the year,month,day,hour values to be used for the partition
        values = [k.split('=')[1] for k in keys]
        storage_descriptor['Location'] = '{0}{1}'.format(location, '/'.join(keys))
        partitions.add(json.dumps({"StorageDescriptor": storage_descriptor ,"Values": list(values)}))

    print(partitions)
    #batch add partitions
    response = glue.batch_create_partition(
        CatalogId=account_id,
        DatabaseName=database_name,
        TableName=table_name,
        PartitionInputList=list(json.loads(part) for part in partitions)
    )
if __name__ == "__main__":
    main(sys.argv[1:])