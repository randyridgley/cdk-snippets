import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job

## @params: [JOB_NAME]
args = getResolvedOptions(sys.argv, ['JOB_NAME','GLUE_DATABASE','GLUE_TABLE_NAME','S3_OUTPUT_BUCKET'])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)
## @type: DataSource
## @args: [database = "database", table_name = "table", transformation_ctx = "datasource0"]
## @return: datasource0
## @inputs: []
datasource0 = glueContext.create_dynamic_frame.from_catalog(database = args['GLUE_DATABASE'], table_name = args['GLUE_TABLE_NAME'], transformation_ctx = "datasource0")
## @type: ApplyMapping
## @args: [mapping = [("datetime", "string", "datetime", "string"), ("sensorid", "int", "sensorid", "int"), ("temp", "int", "temp", "int"), ("battery", "string", "battery", "string"), ("year", "int", "year", "int"), ("month", "int", "month", "int"), ("day", "int", "day", "int"), ("hour", "int", "hour", "int")], transformation_ctx = "applymapping1"]
## @return: applymapping1
## @inputs: [frame = datasource0]
applymapping1 = ApplyMapping.apply(frame = datasource0, mappings = [("datetime", "string", "datetime", "string"), ("sensorid", "int", "sensorid", "int"), ("temp", "int", "temp", "int"), ("battery", "string", "battery", "string"), ("year", "int", "year", "int"), ("month", "int", "month", "int"), ("day", "int", "day", "int"), ("hour", "int", "hour", "int")], transformation_ctx = "applymapping1")
## @type: ResolveChoice
## @args: [choice = "make_struct", transformation_ctx = "resolvechoice2"]
## @return: resolvechoice2
## @inputs: [frame = applymapping1]
resolvechoice2 = ResolveChoice.apply(frame = applymapping1, choice = "make_struct", transformation_ctx = "resolvechoice2")
## @type: DropNullFields
## @args: [transformation_ctx = "dropnullfields3"]
## @return: dropnullfields3
## @inputs: [frame = resolvechoice2]
dropnullfields3 = DropNullFields.apply(frame = resolvechoice2, transformation_ctx = "dropnullfields3")
## @type: DataSink
## @args: [connection_type = "s3", connection_options = {"path": "s3://path/sensors/"}, format = "parquet", transformation_ctx = "datasink4"]
## @return: datasink4
## @inputs: [frame = dropnullfields3]
datasink4 = glueContext.write_dynamic_frame.from_options(frame = dropnullfields3, connection_type = "s3", connection_options = {"path": "s3://" + args['S3_OUTPUT_BUCKET'] + "/sensors/", "partitionKeys": ["year", "month", "day"]}, format = "parquet", transformation_ctx = "datasink4")
job.commit()