ZendeskPusher::Application.routes.draw do
  get "streams/show"

  resources :projects, except: [:index] do
    put '/reorder' => 'projects#reorder', as: :reorder_stages
    resources :deploys, only: [:new, :create, :show, :destroy]
    resources :stages
    resources :webhooks, only: [:index, :create, :destroy]
  end

  resources :deploys, only: [:index] do
    member do
      get :stream, to: 'streams#show'
    end

    collection do
      get :active
    end
  end

  get '/auth/zendesk/callback', to: 'sessions#zendesk'
  get '/auth/github/callback', to: 'sessions#github'
  get '/auth/failure', to: 'sessions#failure'

  get '/login', to: 'sessions#new'
  get '/logout', to: 'sessions#destroy'

  namespace :admin do
    resource :users, only: [:show, :update]
    resource :projects, only: [:show]
    resources :commands, except: [:show]
  end

  scope :integrations do
    post "/travis/:token" => "travis#create", as: :travis_deploy
    post "/semaphore/:token" => "semaphore#create", as: :semaphore_deploy
    post "/tddium/:token" => "tddium#create", as: :tddium_deploy
  end

  root to: 'projects#index'
end
