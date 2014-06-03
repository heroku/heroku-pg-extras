class Heroku::Command::Pg < Heroku::Command::Base
  DIAGNOSE_URL = ENV.fetch('PGDIAGNOSE_URL', "https://pgdiagnose.herokuapp.com")
  # pg:diagnose [DATABASE|REPORT_ID]
  #
  # run diagnostics report on DATABASE
  #
  # defaults to DATABASE_URL databases if no DATABASE is specified
  # if REPORT_ID is specified instead, a previous report is displayed
  def diagnose
    db_id = shift_argument

    track_extra('diagnose') if can_track?
    report = find_or_generate_report(db_id)

    puts "Report #{report["id"]} for #{report["app"]}::#{report["database"]}"
    puts "available for one month after creation on #{report["created_at"]}"
    puts

    c = report['checks']
    process_checks 'red',     c.select{|f| f['status'] == 'red'}
    process_checks 'yellow',  c.select{|f| f['status'] == 'yellow'}
    process_checks 'green',   c.select{|f| f['status'] == 'green'}
    process_checks 'unknown', c.reject{|f| %w(red yellow green).include?(f['status'])}
  end

  private

  def find_or_generate_report(db_id)
    if db_id =~ /\A[a-z0-9\-]{36}\z/
      response = get_report(db_id)
    else
      response = generate_report(db_id)
    end

    JSON.parse(response.body)
  rescue Excon::Errors::Error
    error("Unable to connect to PGDiagnose API, please try again later")
  end

  def get_report(report_id)
    Excon.get("#{DIAGNOSE_URL}/reports/#{report_id}", :headers => {"Content-Type" => "application/json"})
  end

  def generate_report(db_id)
    attachment = generate_resolver.resolve(db_id, "DATABASE_URL")
    validate_arguments!


    @uri = URI.parse(attachment.url) # for nine_two?
    if !nine_two?
      warn "WARNING: pg:diagnose is only fully suppoted on Postgres version >= 9.2. Some checks will be skipped.\n\n"
    end

    if attachment.starter_plan?
      metrics = nil
    else
      metrics = hpg_client(attachment).metrics
    end

    params = {
      'url'  => attachment.url,
      'plan' => attachment.plan,
      'metrics' => metrics,
      'app'  => attachment.app,
      'database' => attachment.config_var
    }

    return Excon.post("#{DIAGNOSE_URL}/reports", :body => params.to_json, :headers => {"Content-Type" => "application/json"})
  end

  def color(message, status)
    if $stdout.tty?
      color_code = { "red" => 31, "green" => 32, "yellow" => 33 }.fetch(status, 35)
      return "\e[#{color_code}m#{message}\e[0m"
    else
      return message
    end
  end

  def process_checks(status, checks)
    return unless checks.size > 0

    checks.each do |check|
      status = check['status']
      puts color("#{status.upcase}: #{check['name']}", status)
      next if "green" == status

      results = check['results']
      return unless results && results.size > 0

      if results.first.kind_of? Array
        puts "  " + results.first.map(&:capitalize).join(" ")
      else
        display_table(
          results,
          results.first.keys,
          results.first.keys.map{ |field| field.split(/_/).map(&:capitalize).join(' ') }
        )
      end
      puts
    end
  end
end

