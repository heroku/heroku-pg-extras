# pg-extras

A heroku plugin for awesome pg:* commands that are also great and fun and super.

### Installation

```bash
~ ➤ heroku plugins:install git://github.com/heroku/heroku-pg-extras.git
```

### Usage

``` bash
~ ➤ heroku pg:cache_hit -adashboard
      name      |         ratio
----------------+------------------------
 index hit rate | 0.99957765013541945832
 cache hit rate |                   1.00
(2 rows)

~ ➤ heroku pg:index_usage -adashboard
       relname       | percent_of_times_index_used | rows_in_table
---------------------+-----------------------------+---------------
 events              |                          65 |       1217347
 app_infos           |                          74 |        314057
 app_infos_user_info |                           0 |        198848
 user_info           |                           5 |         94545
 delayed_jobs        |                          27 |             0
(5 rows)

~ ➤ heroku pg:ps
 procpid |                 source                   |   running_for   | waiting |         query
---------+------------------------------------------+-----------------+---------+-----------------------
   31776 | psql                                     | 00:19:08.017088 | f       | <IDLE> in transaction
   31912 | psql                                     | 00:18:56.12178  | t       | select * from hello;
   32670 | Heroku Postgres Data Clip daaiifuuraiyks | 00:00:25.625609 | f       | BEGIN READ ONLY; select pg_sleep(60)
(2 rows)

~ ➤ heroku pg:locks
 procpid | relname | transactionid | granted |     query_snippet     |       age
---------+---------+---------------+---------+-----------------------+-----------------
   31776 |         |               | t       | <IDLE> in transaction | 00:19:29.837898
   31776 |         |          1294 | t       | <IDLE> in transaction | 00:19:29.837898
   31912 |         |               | t       | select * from hello;  | 00:19:17.94259
    3443 |         |               | t       |                      +| 00:00:00
         |         |               |         |    select            +|
         |         |               |         |      pg_stat_activi   |
(4 rows)

~ ➤ heroku pg:blocking
 blocked_pid |    blocking_statement    | blocking_duration | blocking_pid |                                        blocked_statement                           | blocked_duration
-------------+--------------------------+-------------------+--------------+------------------------------------------------------------------------------------+------------------
         461 | select count(*) from app | 00:00:03.838314   |        15682 | UPDATE "app" SET "updated_at" = '2013-03-04 15:07:04.746688' WHERE "id" = 12823149 | 00:00:03.821826
(1 row)

~ ➤ heroku pg:kill 31912
 pg_cancel_backend
-------------------
 t
(1 row)

~ ➤ heroku pg:kill --force 32670
 pg_terminate_backend
----------------------
 t
(1 row)

~ ➤ heroku pg:killall
 pg_terminate_backend
----------------------
 t
 t
(2 rows)

~ ➤ heroku pg:ps
 procpid | source |   running_for   | waiting |         query
---------+--------+-----------------+---------+-----------------------
   31776 | psql   | 00:20:45.671725 | f       | <IDLE> in transaction
(1 row)

~ ➤ heroku pg:total_index_size
  size
-------
 28194 MB
(1 row)

~ ➤ heroku pg:index_size
                             name                              |  size
---------------------------------------------------------------+---------
 idx_activity_attemptable_and_type_lesson_enrollment           | 5196 MB
 index_enrollment_attemptables_by_attempt_and_last_in_group    | 4045 MB
 index_attempts_on_student_id                                  | 2611 MB
 enrollment_activity_attemptables_pkey                         | 2513 MB
 index_attempts_on_student_id_final_attemptable_type           | 2466 MB
 attempts_pkey                                                 | 2466 MB
 index_attempts_on_response_id                                 | 2404 MB
 index_attempts_on_enrollment_id                               | 1957 MB
 index_enrollment_attemptables_by_enrollment_activity_id       | 1789 MB
 enrollment_activities_pkey                                    |  458 MB
 index_enrollment_activities_by_lesson_enrollment_and_activity |  402 MB
 index_placement_attempts_on_response_id                       |  109 MB
 index_placement_attempts_on_placement_test_id                 |  108 MB
 index_placement_attempts_on_grade_level_id                    |   97 MB
 index_lesson_enrollments_on_lesson_id                         |   93 MB
(truncated results for brevity)

~ ➤ heroku pg:unused_indexes
          table      |                       index                | index_size | index_scans
---------------------+--------------------------------------------+------------+-------------
 public.grade_levels | index_placement_attempts_on_grade_level_id | 97 MB      |           0
 public.observations | observations_attrs_grade_resources         | 33 MB      |           0
 public.messages     | user_resource_id_idx                       | 12 MB      |           0
(3 rows)

~ ➤ heroku pg:seq_scans

               name                |  count
-----------------------------------+----------
 learning_coaches                  | 44820063
 states                            | 36794975
 grade_levels                      | 13972293
 charities_customers               |  8615277
 charities                         |  4316276
 messages                          |  3922247
 contests_customers                |  2915972
 classroom_goals                   |  2142014
 contests                          |  1370267
 goals                             |  1112659
 districts                         |   158995
 rollup_reports                    |   115942
 customers                         |    93847
 schools                           |    92984
 classrooms                        |    92982
 customer_settings                 |    91226
(truncated results for brevity)

~ ➤ heroku pg:long_running_queries

  pid  |    duration     |                                      query
-------+-----------------+---------------------------------------------------------------------------------------
 19578 | 02:29:11.200129 | EXPLAIN SELECT  "students".* FROM "students"  WHERE "students"."id" = 1450645 LIMIT 1
 19465 | 02:26:05.542653 | EXPLAIN SELECT  "students".* FROM "students"  WHERE "students"."id" = 1889881 LIMIT 1
 19632 | 02:24:46.962818 | EXPLAIN SELECT  "students".* FROM "students"  WHERE "students"."id" = 1581884 LIMIT 1
(truncated results for brevity)

~ ➤ heroku pg:bloat

 type  | schemaname |           object_name         | bloat |   waste
-------+------------+-------------------------------+-------+----------
 table | public     | bloated_table                 |   1.1 | 98 MB
 table | public     | other_bloated_table           |   1.1 | 58 MB
 index | public     | bloated_table::bloated_index  |   3.7 | 34 MB
 table | public     | clean_table                   |   0.2 | 3808 kB
 table | public     | other_clean_table             |   0.3 | 1576 kB

~ ➤ heroku pg:vacuum_stats
 schema |         table         | last_vacuum | last_autovacuum  |    rowcount    | dead_rowcount  | autovacuum_threshold | expect_autovacuum 
--------+-----------------------+-------------+------------------+----------------+----------------+----------------------+-------------------
 public | log_table             |             | 2013-04-26 17:37 |         18,030 |              0 |          3,656       | 
 public | data_table            |             | 2013-04-26 13:09 |             79 |             28 |             66       | 
 public | other_table           |             | 2013-04-26 11:41 |             41 |             47 |             58       | 
 public | queue_table           |             | 2013-04-26 17:39 |             12 |          8,228 |             52       | yes
 public | picnic_table          |             |                  |             13 |              0 |             53       | 

~ ➤ heroku pg:vacuum_stats
 schema |         table         | last_vacuum | last_autovacuum  |    rowcount    | dead_rowcount  | autovacuum_threshold | expect_autovacuum 
--------+-----------------------+-------------+------------------+----------------+----------------+----------------------+-------------------
 public | log_table             |             | 2013-04-26 17:37 |         18,030 |              0 |          3,656       | 
 public | data_table            |             | 2013-04-26 13:09 |             79 |             28 |             66       | 
 public | other_table           |             | 2013-04-26 11:41 |             41 |             47 |             58       | 
 public | queue_table           |             | 2013-04-26 17:39 |             12 |          8,228 |             52       | yes
 public | picnic_table          |             |                  |             13 |              0 |             53       | 

~ ➤ heroku pg:mandelbrot

```

# pgbackups:transfer

A Heroku CLI plugin to add direct database-to-database transfer
capability to `pgbackups`. A direct transfer can be a much faster
mechanism than taking a snapshot where a fork-based replication
is not possible.

## Usage

```bash
$ heroku pgbackups:transfer --help
Usage: heroku pgbackups:transfer [DATABASE_FROM] DATABASE_TO

 transfer directly from the first database to the second

 if no DATABASE_FROM is specified, defaults to DATABASE_URL
 the database backup is transferred directly to DATABASE_TO without an intermediate dump
```

And some example usage:

```bash
# the pgbackups add-on is required to use direct transfers
$ heroku addons:add pgbackups --app example
# then you can transfer directly using either names or raw URLs
$ heroku pgbackups:transfer green teal --app example
# note that both the FROM and TO database must be accessible to the pgbackups service
$ heroku pgbackups:transfer DATABASE postgres://user:password@host/dbname --app example
# logs for the transfer are available via the standard logs for your app
$ heroku logs --tail --ps pgbackups --app example
```
