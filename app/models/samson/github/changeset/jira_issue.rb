# frozen_string_literal: true
module Samson
  module Github
    class Changeset::JiraIssue
      attr_reader :url

      def initialize(url)
        @url = url
      end

      def reference
        @url.split("/").last
      end

      def ==(other)
        url == other.url
      end
    end
  end
end
