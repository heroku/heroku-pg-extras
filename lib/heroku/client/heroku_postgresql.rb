class Heroku::Client::HerokuPostgresql
  def incidents
    http_get "#{resource_name}/incidents"
  end

  def fdw_list
    http_get "#{resource_name}/links"
  end

  def fdw_set(target, as = nil)
    http_post "#{resource_name}/links", 'target' => target, 'as' => as
  end

  def fdw_delete(id)
    http_delete "#{resource_name}/links/#{id}"
  end
end
