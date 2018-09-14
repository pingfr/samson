# frozen_string_literal: true
require_relative '../../test_helper'

SingleCov.covered!

describe Integrations::GithubController do
  extend IntegrationsControllerTestHelper

  let(:commit) { "dc395381e650f3bac18457909880829fc20e34ba" }
  let(:commit_message) { "hi" }
  let(:project) { projects(:test) }
  let(:payload) do
    {
      ref: 'refs/heads/dev',
      after: commit,
      head_commit: {
        message: commit_message
      }
    }.with_indifferent_access
  end
  let(:user_name) { 'Github' }

  before do
    Deploy.delete_all
    request.headers['X-Github-Event'] = 'push'
    project.webhooks.create!(stage: stages(:test_staging), branch: "dev", source: 'any')
  end

  test_regular_commit "Github", no_mapping: {ref: 'refs/heads/foobar'}, failed: false

  it_ignores_skipped_commits

  it_does_not_deploy 'when the event is invalid' do
    request.headers['X-Github-Event'] = 'event'
  end

  describe "when signature is enforced" do
    with_env GITHUB_HOOK_SECRET: 'test'

    before do
      hmac = OpenSSL::HMAC.hexdigest(OpenSSL::Digest.new('sha1'), ENV['GITHUB_HOOK_SECRET'], payload.to_param)
      request.headers['X-Hub-Signature'] = "sha1=#{hmac}"
    end

    it_deploys "when signature is valid"

    it_does_not_deploy "when signature is invalid", status: 401 do
      request.headers['X-Hub-Signature'] = "nope"
    end

    it_does_not_deploy "when signature is invalid", status: 401 do
      request.headers['X-Hub-Signature'] = nil
    end
  end

  describe 'with a pull request event' do
    before { request.headers['X-Github-Event'] = 'pull_request' }

    let(:payload) do
      {
        action: 'edited',
        changes: {
          body: {
            from: 'something'
          }
        },
        after: commit,
        number: '42',
        pull_request: {
          head: {
            ref: 'dev', # name of branch the user created
            sha: 'abcdef'
          },
          state: 'open',
          body: 'imafixwolves [samson review]'
        }
      }.with_indifferent_access
    end

    it_deploys

    it_does_not_deploy 'with a non-open pull request state' do
      payload.deep_merge!(pull_request: {state: 'closed'})
    end

    it_does_not_deploy 'without "[samson review]" in the body' do
      payload.deep_merge!(pull_request: {body: 'imafixwolves'})
    end
  end

  describe 'with a commit status event' do
    it 'updates all releases of that commit' do
      sha = "dc395381e650f3bac18457909880829fc20e34ba"

      release = project.releases.create!(
        commit: sha,
        author: users(:deployer)
      )

      # Fast forward the clock.
      later = 1.minute.from_now
      Time.stubs(:now).returns later

      payload = {
        token: project.token,
        sha: sha
      }

      request.headers['X-Github-Event'] = 'status'
      post :create, params: payload

      assert_response :success

      # Time objects can't be reliably compared due to the use of floating
      # point numbers in their representation, so we convert to Integer before
      # comparing.
      release.reload.updated_at.to_i.must_equal later.to_i
    end
  end

  describe 'with a pull issue comment' do
    let(:payload) do
      {
        action: 'created',
        comment: {body: '[samson review]'},
        issue: {number: 123}
      }.with_indifferent_access
    end

    before do
      request.headers['X-Github-Event'] = 'issue_comment'
      Samson::Github::Changeset::IssueComment.any_instance.expects(:pull_request).at_least_once.returns(stub(sha: 'abc', branch: 'dev'))
      #Gitlab::Changeset::IssueComment.any_instance.expects(:pull_request).at_least_once.returns(stub(sha: 'abc', branch: 'dev'))
    end

    it_deploys
  end

  describe 'with payload as json because it is using x-ww-form-encoded' do
    def payload
      {
        payload: super.to_json
      }
    end

    it_deploys
  end
end
