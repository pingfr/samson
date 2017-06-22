# frozen_string_literal: true
class AccessControl
  class << self
    def can?(user, action, resource, project = nil)
      case resource
      when 'builds'
        case action
        when :read then true
        when :write then user.deployer_for?(project)
        else raise ArgumentError, "Unsupported action #{action}"
        end
      when 'locks'
        case action
        when :read then true
        when :write
          if project
            user.deployer_for?(project) # stage locks
          else
            user.admin? # global locks
          end
        else raise ArgumentError, "Unsupported action #{action}"
        end
      when 'projects'
        case action
        when :read then true
        when :write then user.admin_for?(project)
        else raise ArgumentError, "Unsupported action #{action}"
        end
      when 'users'
        case action
        when :read then user.admin?
        when :write then user.super_admin?
        else raise ArgumentError, "Unsupported action #{action}"
        end
      else
        raise ArgumentError, "Unsupported resource #{resource}"
      end
    end
  end
end
