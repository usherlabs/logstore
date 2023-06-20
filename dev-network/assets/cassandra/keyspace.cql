-- ### NEW KEYSPACE ### --
CREATE KEYSPACE IF NOT EXISTS logstore_dev WITH REPLICATION = { 'class' : 'SimpleStrategy', 'replication_factor' : 1 };
USE logstore_dev;

CREATE TABLE IF NOT EXISTS bucket
(
    stream_id   text,
    partition   int,
    date_create timestamp,
    id          timeuuid,
    records     int,
    size        int,
    primary key ((stream_id, partition), date_create)
) WITH CLUSTERING ORDER BY (date_create desc);

CREATE TABLE IF NOT EXISTS stream_data
(
    stream_id    text,
    partition    int,
    bucket_id    timeuuid,
    ts           timestamp,
    sequence_no  int,
    publisher_id text,
    msg_chain_id text,
    payload      blob,
    primary key ((stream_id, partition, bucket_id), ts, sequence_no, publisher_id, msg_chain_id)
) WITH CLUSTERING ORDER BY (ts ASC, sequence_no ASC);

-- ### KEYSPACES FOR BROKER CONSENSUS TESTS ### --

-- ### NEW KEYSPACE ### --
CREATE KEYSPACE IF NOT EXISTS logstore_test WITH REPLICATION = { 'class' : 'SimpleStrategy', 'replication_factor' : 1 };
USE logstore_test;

CREATE TABLE IF NOT EXISTS bucket
(
    stream_id   text,
    partition   int,
    date_create timestamp,
    id          timeuuid,
    records     int,
    size        int,
    primary key ((stream_id, partition), date_create)
) WITH CLUSTERING ORDER BY (date_create desc);

CREATE TABLE IF NOT EXISTS stream_data
(
    stream_id    text,
    partition    int,
    bucket_id    timeuuid,
    ts           timestamp,
    sequence_no  int,
    publisher_id text,
    msg_chain_id text,
    payload      blob,
    primary key ((stream_id, partition, bucket_id), ts, sequence_no, publisher_id, msg_chain_id)
) WITH CLUSTERING ORDER BY (ts ASC, sequence_no ASC);

-- ### NEW KEYSPACE ### --
CREATE KEYSPACE IF NOT EXISTS logstore_test_01 WITH REPLICATION = { 'class' : 'SimpleStrategy', 'replication_factor' : 1 };
USE logstore_test_01;

CREATE TABLE IF NOT EXISTS bucket
(
    stream_id   text,
    partition   int,
    date_create timestamp,
    id          timeuuid,
    records     int,
    size        int,
    primary key ((stream_id, partition), date_create)
) WITH CLUSTERING ORDER BY (date_create desc);

CREATE TABLE IF NOT EXISTS stream_data
(
    stream_id    text,
    partition    int,
    bucket_id    timeuuid,
    ts           timestamp,
    sequence_no  int,
    publisher_id text,
    msg_chain_id text,
    payload      blob,
    primary key ((stream_id, partition, bucket_id), ts, sequence_no, publisher_id, msg_chain_id)
) WITH CLUSTERING ORDER BY (ts ASC, sequence_no ASC);

-- ### NEW KEYSPACE ### --
CREATE KEYSPACE IF NOT EXISTS logstore_test_02 WITH REPLICATION = { 'class' : 'SimpleStrategy', 'replication_factor' : 1 };
USE logstore_test_02;

CREATE TABLE IF NOT EXISTS bucket
(
    stream_id   text,
    partition   int,
    date_create timestamp,
    id          timeuuid,
    records     int,
    size        int,
    primary key ((stream_id, partition), date_create)
) WITH CLUSTERING ORDER BY (date_create desc);

CREATE TABLE IF NOT EXISTS stream_data
(
    stream_id    text,
    partition    int,
    bucket_id    timeuuid,
    ts           timestamp,
    sequence_no  int,
    publisher_id text,
    msg_chain_id text,
    payload      blob,
    primary key ((stream_id, partition, bucket_id), ts, sequence_no, publisher_id, msg_chain_id)
) WITH CLUSTERING ORDER BY (ts ASC, sequence_no ASC);

-- ### NEW KEYSPACE ### --
CREATE KEYSPACE IF NOT EXISTS logstore_test_03 WITH REPLICATION = { 'class' : 'SimpleStrategy', 'replication_factor' : 1 };
USE logstore_test_03;

CREATE TABLE IF NOT EXISTS bucket
(
    stream_id   text,
    partition   int,
    date_create timestamp,
    id          timeuuid,
    records     int,
    size        int,
    primary key ((stream_id, partition), date_create)
) WITH CLUSTERING ORDER BY (date_create desc);

CREATE TABLE IF NOT EXISTS stream_data
(
    stream_id    text,
    partition    int,
    bucket_id    timeuuid,
    ts           timestamp,
    sequence_no  int,
    publisher_id text,
    msg_chain_id text,
    payload      blob,
    primary key ((stream_id, partition, bucket_id), ts, sequence_no, publisher_id, msg_chain_id)
) WITH CLUSTERING ORDER BY (ts ASC, sequence_no ASC);

-- ### NEW KEYSPACE ### --
CREATE KEYSPACE IF NOT EXISTS logstore_broker_1 WITH REPLICATION = { 'class' : 'SimpleStrategy', 'replication_factor' : 1 };
USE logstore_broker_1;

CREATE TABLE IF NOT EXISTS bucket
(
    stream_id   text,
    partition   int,
    date_create timestamp,
    id          timeuuid,
    records     int,
    size        int,
    primary key ((stream_id, partition), date_create)
) WITH CLUSTERING ORDER BY (date_create desc);

CREATE TABLE IF NOT EXISTS stream_data
(
    stream_id    text,
    partition    int,
    bucket_id    timeuuid,
    ts           timestamp,
    sequence_no  int,
    publisher_id text,
    msg_chain_id text,
    payload      blob,
    primary key ((stream_id, partition, bucket_id), ts, sequence_no, publisher_id, msg_chain_id)
) WITH CLUSTERING ORDER BY (ts ASC, sequence_no ASC);

-- ### NEW KEYSPACE ### --
CREATE KEYSPACE IF NOT EXISTS logstore_broker_2 WITH REPLICATION = { 'class' : 'SimpleStrategy', 'replication_factor' : 1 };
USE logstore_broker_2;

CREATE TABLE IF NOT EXISTS bucket
(
    stream_id   text,
    partition   int,
    date_create timestamp,
    id          timeuuid,
    records     int,
    size        int,
    primary key ((stream_id, partition), date_create)
) WITH CLUSTERING ORDER BY (date_create desc);

CREATE TABLE IF NOT EXISTS stream_data
(
    stream_id    text,
    partition    int,
    bucket_id    timeuuid,
    ts           timestamp,
    sequence_no  int,
    publisher_id text,
    msg_chain_id text,
    payload      blob,
    primary key ((stream_id, partition, bucket_id), ts, sequence_no, publisher_id, msg_chain_id)
) WITH CLUSTERING ORDER BY (ts ASC, sequence_no ASC);

-- ### NEW KEYSPACE ### --
CREATE KEYSPACE IF NOT EXISTS logstore_broker_3 WITH REPLICATION = { 'class' : 'SimpleStrategy', 'replication_factor' : 1 };
USE logstore_broker_3;

CREATE TABLE IF NOT EXISTS bucket
(
    stream_id   text,
    partition   int,
    date_create timestamp,
    id          timeuuid,
    records     int,
    size        int,
    primary key ((stream_id, partition), date_create)
) WITH CLUSTERING ORDER BY (date_create desc);

CREATE TABLE IF NOT EXISTS stream_data
(
    stream_id    text,
    partition    int,
    bucket_id    timeuuid,
    ts           timestamp,
    sequence_no  int,
    publisher_id text,
    msg_chain_id text,
    payload      blob,
    primary key ((stream_id, partition, bucket_id), ts, sequence_no, publisher_id, msg_chain_id)
) WITH CLUSTERING ORDER BY (ts ASC, sequence_no ASC);
