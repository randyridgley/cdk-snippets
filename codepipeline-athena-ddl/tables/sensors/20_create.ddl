CREATE EXTERNAL TABLE `sensors`(
  `datetime` string COMMENT 'from deserializer', 
  `sensorid` int COMMENT 'from deserializer', 
  `temp` int COMMENT 'from deserializer', 
  `battery` string COMMENT 'from deserializer')
PARTITIONED BY ( 
  `year` string, 
  `month` string, 
  `day` string, 
  `hour` string)
ROW FORMAT SERDE 
  'org.openx.data.jsonserde.JsonSerDe' 
WITH SERDEPROPERTIES ( 
  'paths'='battery,datetime,sensorid,temp') 
STORED AS INPUTFORMAT 
  'org.apache.hadoop.mapred.TextInputFormat' 
OUTPUTFORMAT 
  'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
LOCATION
  '${LOCATION}'
TBLPROPERTIES (
  'classification'='json', 
  'compressionType'='none', 
  'transient_lastDdlTime'='1589318807')