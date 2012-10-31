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


```
