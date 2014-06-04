class Heroku::Client::HerokuPostgresql
  def upgrade
    http_post "#{resource_name}/upgrade"
  end

  def upgrade_status
    http_get "#{resource_name}/upgrade_status"
  end

  def maintenance_info
    http_get "#{resource_name}/maintenance"
  end

  def maintenance_run
    http_post "#{resource_name}/maintenance"
  end

  def maintenance_window_set(description)
    http_put "#{resource_name}/maintenance_window", 'description' => description
  end

  def incidents
    http_get "#{resource_name}/incidents"
  end

  def connection_reset
    http_post "#{resource_name}/connection_reset"
  end
end
