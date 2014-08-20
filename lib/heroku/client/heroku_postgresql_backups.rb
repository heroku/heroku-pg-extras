class Heroku::Client::HerokuPostgresql
  def backups
    http_get "#{resource_name}/transfers"
  end

  def backups_get(id, verbose=false)
    http_get "#{resource_name}/transfers/#{URI.encode(id.to_s)}?verbose=#{verbose}"
  end

  def backups_capture
    http_post "#{resource_name}/backups"
  end

  def backups_restore(backup_url)
    http_post "#{resource_name}/restores", 'backup_url' => backup_url
  end

  def backups_delete(id)
    http_delete "#{resource_name}/backups/#{URI.encode(id.to_s)}"
  end

  def pg_copy(source_name, source_url, target_name, target_url)
    http_post "#{resource_name}/transfers", {
      'from_name' => source_name,
      'from_url' => source_url,
      'to_name' => target_name,
      'to_url' => target_url,
    }
  end

  def schedules
    http_get "#{resource_name}/transfer-schedules"
  end

  def schedule
    http_post "#{resource_name}/transfer-schedules"
  end

  def unschedule(id)
    http_delete "#{resource_name}/transfer-schedules/#{URI.encode(id.to_s)}"
  end

  private

  def http_delete(path)
    checking_client_version do
      response = heroku_postgresql_resource[path].delete
      display_heroku_warning response
      sym_keys(json_decode(response.to_s))
    end
  end
end
