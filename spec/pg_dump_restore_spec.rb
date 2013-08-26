require './pg_dump_restore'
describe PgDumpRestore, 'pull' do
  before do
    @localdb  = 'postgres:///localdbname'
    @remotedb = 'postgres://uname:pass@remotehost/remotedbname'
  end

  it 'requires uris for from and to arguments' do
    expect { PgDumpRestore.new(nil      , @localdb, mock) }.to     raise_error
    expect { PgDumpRestore.new(@remotedb, nil     , mock) }.to     raise_error
    expect { PgDumpRestore.new(@remotedb, @localdb, mock) }.to_not raise_error
  end

  it 'on pulls, prepare requires the local database to not exist' do
    mock_command = mock
    mock_command.should_receive(:error).once
    pgdr = PgDumpRestore.new(@remotedb, @localdb, mock_command)
    pgdr.should_receive(:`).once.and_return(`false`)

    pgdr.prepare
  end

  it 'on pushes, prepare requires the remote database to be empty' do
    mock_command = mock
    mock_command.should_receive(:error).once
    pgdr = PgDumpRestore.new(@localdb, @remotedb, mock_command)
    mock_command.should_receive(:exec_sql_on_uri).once.and_return("something that isn't a true")
    pgdr.prepare
  end

  it 'executes a proper dump/restore command' do
    pgdr = PgDumpRestore.new(@remotedb, @localdb, mock)
    expect(pgdr.dump_restore_cmd).to match(/
      pg_dump        .*
      remotehost     .*
      remotedbname   .*
      \|             .*
      pg_restore     .*
      localhost      .*
      localdbname
    /x)
  end

  describe 'verification' do
    it 'errors when the extensions do not match' do
      mock_command = mock
      mock_command.should_receive(:error).once
      pgdr = PgDumpRestore.new(@localdb, @remotedb, mock_command)
      mock_command.should_receive(:exec_sql_on_uri).twice.and_return("these", "don't match")
      pgdr.verify
    end

    it 'is fine when the extensions match' do
      mock_command = mock
      mock_command.should_not_receive(:error)
      pgdr = PgDumpRestore.new(@localdb, @remotedb, mock_command)
      mock_command.should_receive(:exec_sql_on_uri).twice.and_return("these match", "these match")
      pgdr.verify
    end
  end
end
