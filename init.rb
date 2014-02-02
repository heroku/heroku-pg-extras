require "heroku/command/base"

if Heroku::VERSION.split(/\./).first.to_i < 3
  $stderr.puts(Heroku::Helpers.format_with_bang(<<-EOM))
The heroku-pg-extras plugin was not loaded.
It requires Heroku CLI version >= 3.0.0. You are using #{Heroku::VERSION}.
EOM
else
 require File.expand_path('lib/heroku/command/pgbackups', File.dirname(__FILE__))
 require File.expand_path('lib/heroku/client/heroku_postgresql', File.dirname(__FILE__))
 require File.expand_path('lib/heroku/client/attachment', File.dirname(__FILE__))
 require File.expand_path('lib/heroku/command/pg', File.dirname(__FILE__))
end
