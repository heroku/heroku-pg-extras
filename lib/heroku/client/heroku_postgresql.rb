class Heroku::Client::HerokuPostgresql
  def incidents
    http_get "#{resource_name}/incidents"
  end

  def stats_reset
    http_put "#{resource_name}/stats_reset"
  end
end
