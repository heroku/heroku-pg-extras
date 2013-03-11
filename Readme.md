# pg-extras

A heroku plugin for awesome pg:* commands that are also great and fun and super.

``` bash
~ ➤ heroku plugins:install git://github.com/heroku/heroku-pg-extras.git

~ ➤ heroku pg:cachehit -adashboard
      name      |         ratio          
----------------+------------------------
 index hit rate | 0.99957765013541945832
 cache hit rate |                   1.00
(2 rows)

~ ➤ heroku pg:indexusage -adashboard
       relname       | percent_of_times_index_used | rows_in_table 
---------------------+-----------------------------+---------------
 events              |                          65 |       1217347
 app_infos           |                          74 |        314057
 app_infos_user_info |                           0 |        198848
 user_info           |                           5 |         94545
 delayed_jobs        |                          27 |             0
(5 rows) 

~ ➤ heroku pg:ps -a will
 procpid |                 source                   |   running_for   | waiting |         query
---------+------------------------------------------+-----------------+---------+-----------------------
   31776 | psql                                     | 00:19:08.017088 | f       | <IDLE> in transaction
   31912 | psql                                     | 00:18:56.12178  | t       | select * from hello;
   32670 | Heroku Postgres Data Clip daaiifuuraiyks | 00:00:25.625609 | f       | BEGIN READ ONLY; select pg_sleep(60)
(2 rows)

~ ➤ heroku pg:locks -a will
 procpid | relname | transactionid | granted |     query_snippet     |       age
---------+---------+---------------+---------+-----------------------+-----------------
   31776 |         |               | t       | <IDLE> in transaction | 00:19:29.837898
   31776 |         |          1294 | t       | <IDLE> in transaction | 00:19:29.837898
   31912 |         |               | t       | select * from hello;  | 00:19:17.94259
    3443 |         |               | t       |                      +| 00:00:00
         |         |               |         |    select            +|
         |         |               |         |      pg_stat_activi   |
(4 rows)

~ ➤ heroku pg:blocking -a will
 blocked_pid |    blocking_statement    | blocking_duration | blocking_pid |                                        blocked_statement                           | blocked_duration 
-------------+--------------------------+-------------------+--------------+------------------------------------------------------------------------------------+------------------
         461 | select count(*) from app | 00:00:03.838314   |        15682 | UPDATE "app" SET "updated_at" = '2013-03-04 15:07:04.746688' WHERE "id" = 12823149 | 00:00:03.821826
(1 row)

~ ➤ heroku pg:kill 31912 -a will
 pg_cancel_backend
-------------------
 t
(1 row)

~ ➤ heroku pg:kill 32670 -a will
 pg_cancel_backend
-------------------
 t
(1 row)

~ ➤ heroku pg:ps -a will
 procpid | source |   running_for   | waiting |         query
---------+--------+-----------------+---------+-----------------------
   31776 | psql   | 00:20:45.671725 | f       | <IDLE> in transaction
(1 row)

~ ➤ heroku pg:mandelbrot -a will

~ ➤ heroku pg:total_index_size -a will
  mb
-------
 28194
(1 row)

~ ➤ heroku pg:index_size -a will
                             name                              |  mb
---------------------------------------------------------------+------
 idx_activity_attemptable_and_type_lesson_enrollment           | 5196
 index_enrollment_attemptables_by_attempt_and_last_in_group    | 4045
 index_attempts_on_student_id                                  | 2611
 enrollment_activity_attemptables_pkey                         | 2513
 index_attempts_on_student_id_final_attemptable_type           | 2466
 attempts_pkey                                                 | 2466
 index_attempts_on_response_id                                 | 2404
 index_attempts_on_enrollment_id                               | 1957
 index_enrollment_attemptables_by_enrollment_activity_id       | 1789
 enrollment_activities_pkey                                    |  458
 index_enrollment_activities_by_lesson_enrollment_and_activity |  402
 index_placement_attempts_on_response_id                       |  109
 index_placement_attempts_on_placement_test_id                 |  108
 index_placement_attempts_on_grade_level_id                    |   97
 index_lesson_enrollments_on_lesson_id                         |   93
(truncated results for brevity)

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
