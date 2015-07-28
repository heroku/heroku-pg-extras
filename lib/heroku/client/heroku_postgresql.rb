class Heroku::Client::HerokuPostgresql
  def incidents
    http_get "#{resource_name}/incidents"
  end
end
