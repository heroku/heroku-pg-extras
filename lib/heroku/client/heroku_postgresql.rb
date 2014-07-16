class Heroku::Client::HerokuPostgresql
  def incidents
    http_get "#{resource_name}/incidents"
  end

  def connection_reset
    http_post "#{resource_name}/connection_reset"
  end
end
