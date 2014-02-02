class Heroku::Client
  def add_attachment(app, resource, options = {})
    json_decode(
      post("/apps/#{app}/attachments", options.merge(:resource_name => resource))
    )
  end

  def delete_attachment(app, config_var)
    json_decode(
      delete("/apps/#{app}/attachments/#{config_var}")
    )
  end
end
