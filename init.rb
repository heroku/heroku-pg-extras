require "heroku/command/base"

major, minor, _ = Heroku::VERSION.split(/\./).map(&:to_i)
if (major > 3) || (major == 3 && minor >= 4)
 require File.expand_path('lib/heroku/client/heroku_postgresql', File.dirname(__FILE__))
 require File.expand_path('lib/heroku/command/pg', File.dirname(__FILE__))
 require File.expand_path('lib/heroku/command/pgdiagnose', File.dirname(__FILE__))
else
  $stderr.puts(Heroku::Helpers.format_with_bang(<<-EOM))
The heroku-pg-extras plugin was not loaded.
It requires Heroku CLI version >= 3.4.0. You are using #{Heroku::VERSION}.
EOM
end
