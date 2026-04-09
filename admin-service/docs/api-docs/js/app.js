
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "Admin Service",
    "version": "1.0.0",
    "description": "Admin dashboard and management microservice for the Arbex platform.\nProvides dashboard analytics, user management (roles, bans), and proxies\narticle, subscription, promo code, and notification operations to their\nrespective services. gRPC-only, no RabbitMQ — all operations are synchronous.\nExposes a gRPC API on port 50055.\n",
    "contact": {
      "name": "Serg"
    }
  },
  "servers": {
    "grpc": {
      "url": "localhost:50055",
      "protocol": "grpc",
      "description": "gRPC server"
    }
  },
  "defaultContentType": "application/json",
  "channels": {
    "grpc/GetDashboardStats": {
      "description": "Aggregate platform stats — users, articles, categories, views, today counts, banned count. Cached in Redis (60s TTL).",
      "publish": {
        "operationId": "grpcGetDashboardStats",
        "summary": "Get dashboard stats",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "dashboard"
          }
        ],
        "message": {
          "name": "DashboardStatsRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-2>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-1>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcGetDashboardStatsResponse",
        "message": {
          "name": "DashboardStatsResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-4>"
              },
              "total_users": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-5>"
              },
              "total_articles": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-6>"
              },
              "total_categories": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-7>"
              },
              "total_views": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-8>"
              },
              "articles_today": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-9>"
              },
              "users_today": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-10>"
              },
              "total_banned": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-11>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-3>"
          }
        }
      }
    },
    "grpc/ListUsers": {
      "description": "Paginated user list with search, role filter, and ban status filter",
      "publish": {
        "operationId": "grpcListUsers",
        "summary": "List users",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "users"
          }
        ],
        "message": {
          "name": "ListUsersRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-13>"
              },
              "page": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-14>"
              },
              "limit": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-15>"
              },
              "search": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-16>"
              },
              "role": {
                "type": "integer",
                "description": "-1=all, 0=user, 1=admin",
                "x-parser-schema-id": "<anonymous-schema-17>"
              },
              "status": {
                "type": "integer",
                "description": "-1=all, 0=active, 1=banned",
                "x-parser-schema-id": "<anonymous-schema-18>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-12>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcListUsersResponse",
        "message": {
          "name": "ListUsersResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-20>"
              },
              "users": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "x-parser-schema-id": "<anonymous-schema-22>"
                    },
                    "email": {
                      "type": "string",
                      "format": "email",
                      "x-parser-schema-id": "<anonymous-schema-23>"
                    },
                    "username": {
                      "type": "string",
                      "x-parser-schema-id": "<anonymous-schema-24>"
                    },
                    "role": {
                      "type": "integer",
                      "x-parser-schema-id": "<anonymous-schema-25>"
                    },
                    "status": {
                      "type": "integer",
                      "x-parser-schema-id": "<anonymous-schema-26>"
                    },
                    "created_at": {
                      "type": "string",
                      "format": "date-time",
                      "x-parser-schema-id": "<anonymous-schema-27>"
                    },
                    "updated_at": {
                      "type": "string",
                      "format": "date-time",
                      "x-parser-schema-id": "<anonymous-schema-28>"
                    },
                    "banned_at": {
                      "type": "string",
                      "format": "date-time",
                      "x-parser-schema-id": "<anonymous-schema-29>"
                    },
                    "ban_reason": {
                      "type": "string",
                      "x-parser-schema-id": "<anonymous-schema-30>"
                    }
                  },
                  "x-parser-schema-id": "UserRecord"
                },
                "x-parser-schema-id": "<anonymous-schema-21>"
              },
              "pagination": {
                "type": "object",
                "properties": {
                  "page": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-31>"
                  },
                  "limit": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-32>"
                  },
                  "total": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-33>"
                  },
                  "total_pages": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-34>"
                  }
                },
                "x-parser-schema-id": "PaginationMeta"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-19>"
          }
        }
      }
    },
    "grpc/GetUser": {
      "description": "Get a single user by ID",
      "publish": {
        "operationId": "grpcGetUser",
        "summary": "Get user",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "users"
          }
        ],
        "message": {
          "name": "GetUserRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "user_id"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-36>"
              },
              "user_id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-37>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-35>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcGetUserResponse",
        "message": {
          "name": "GetUserResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-39>"
              },
              "user": "$ref:$.channels.grpc/ListUsers.subscribe.message.payload.properties.users.items"
            },
            "x-parser-schema-id": "<anonymous-schema-38>"
          }
        }
      }
    },
    "grpc/UpdateUserRole": {
      "description": "Change a user's role (0=user, 1=admin). Cannot change own role.",
      "publish": {
        "operationId": "grpcUpdateUserRole",
        "summary": "Update user role",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "users"
          }
        ],
        "message": {
          "name": "UpdateUserRoleRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "user_id",
              "role"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-41>"
              },
              "user_id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-42>"
              },
              "role": {
                "type": "integer",
                "description": "0=user, 1=admin",
                "x-parser-schema-id": "<anonymous-schema-43>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-40>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcUpdateUserRoleResponse",
        "message": {
          "name": "UpdateUserRoleResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-45>"
              },
              "message": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-46>"
              },
              "user": "$ref:$.channels.grpc/ListUsers.subscribe.message.payload.properties.users.items"
            },
            "x-parser-schema-id": "<anonymous-schema-44>"
          }
        }
      }
    },
    "grpc/BanUser": {
      "description": "Ban a user with optional reason. Cannot ban admins or self.",
      "publish": {
        "operationId": "grpcBanUser",
        "summary": "Ban user",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "users"
          }
        ],
        "message": {
          "name": "BanUserRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "user_id"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-48>"
              },
              "user_id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-49>"
              },
              "reason": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-50>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-47>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcBanUserResponse",
        "message": {
          "name": "BanUserResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-52>"
              },
              "message": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-53>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-51>"
          }
        }
      }
    },
    "grpc/UnbanUser": {
      "description": "Remove ban from a user",
      "publish": {
        "operationId": "grpcUnbanUser",
        "summary": "Unban user",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "users"
          }
        ],
        "message": {
          "name": "UnbanUserRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "user_id"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-55>"
              },
              "user_id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-56>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-54>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcUnbanUserResponse",
        "message": {
          "name": "UnbanUserResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-58>"
              },
              "message": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-59>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-57>"
          }
        }
      }
    },
    "grpc/CreateArticle": {
      "description": "Create an article — proxied to news-service with access_token passthrough",
      "publish": {
        "operationId": "grpcCreateArticle",
        "summary": "Create article",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "news"
          }
        ],
        "message": {
          "name": "AdminCreateArticleRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "title",
              "content",
              "type"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-61>"
              },
              "title": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-62>"
              },
              "content": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-63>"
              },
              "type": {
                "type": "string",
                "description": "\"blog\" or \"news\"",
                "x-parser-schema-id": "<anonymous-schema-64>"
              },
              "cover_image_url": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-65>"
              },
              "categories": {
                "type": "array",
                "items": {
                  "type": "string",
                  "x-parser-schema-id": "<anonymous-schema-67>"
                },
                "x-parser-schema-id": "<anonymous-schema-66>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-60>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcCreateArticleResponse",
        "message": {
          "name": "AdminArticleResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-69>"
              },
              "article": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-70>"
                  },
                  "title": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-71>"
                  },
                  "slug": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-72>"
                  },
                  "content": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-73>"
                  },
                  "author_id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-74>"
                  },
                  "type": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-75>"
                  },
                  "cover_image_url": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-76>"
                  },
                  "view_count": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-77>"
                  },
                  "published_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-78>"
                  },
                  "created_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-79>"
                  },
                  "updated_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-80>"
                  },
                  "categories": {
                    "type": "array",
                    "items": {
                      "type": "string",
                      "x-parser-schema-id": "<anonymous-schema-82>"
                    },
                    "x-parser-schema-id": "<anonymous-schema-81>"
                  }
                },
                "x-parser-schema-id": "ArticleRecord"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-68>"
          }
        }
      }
    },
    "grpc/DeleteArticle": {
      "description": "Delete an article — proxied to news-service with access_token passthrough",
      "publish": {
        "operationId": "grpcDeleteArticle",
        "summary": "Delete article",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "news"
          }
        ],
        "message": {
          "name": "AdminDeleteArticleRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "article_id"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-84>"
              },
              "article_id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-85>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-83>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcDeleteArticleResponse",
        "message": {
          "name": "AdminDeleteArticleResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-87>"
              },
              "message": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-88>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-86>"
          }
        }
      }
    },
    "grpc/GetUploadUrl": {
      "description": "Get a presigned S3 upload URL — proxied to news-service",
      "publish": {
        "operationId": "grpcGetUploadUrl",
        "summary": "Get upload URL",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "news"
          }
        ],
        "message": {
          "name": "AdminGetUploadUrlRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "filename",
              "content_type"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-90>"
              },
              "filename": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-91>"
              },
              "content_type": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-92>"
              },
              "article_id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-93>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-89>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcGetUploadUrlResponse",
        "message": {
          "name": "AdminGetUploadUrlResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-95>"
              },
              "upload_url": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-96>"
              },
              "file_url": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-97>"
              },
              "expires_in": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-98>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-94>"
          }
        }
      }
    },
    "grpc/GetArticleStats": {
      "description": "Aggregate article stats — proxied to news-service",
      "publish": {
        "operationId": "grpcGetArticleStats",
        "summary": "Get article stats",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "news"
          }
        ],
        "message": {
          "name": "AdminGetArticleStatsRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-100>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-99>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcGetArticleStatsResponse",
        "message": {
          "name": "AdminArticleStatsResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-102>"
              },
              "total_articles": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-103>"
              },
              "total_blog": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-104>"
              },
              "total_news": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-105>"
              },
              "total_views": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-106>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-101>"
          }
        }
      }
    },
    "grpc/AdminSetSubscription": {
      "description": "Manually set a user's subscription — proxied to subscription-service",
      "publish": {
        "operationId": "grpcAdminSetSubscription",
        "summary": "Admin set subscription",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "subscription"
          }
        ],
        "message": {
          "name": "AdminSetSubscriptionRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "user_id",
              "sub_type",
              "duration_months"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-108>"
              },
              "user_id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-109>"
              },
              "sub_type": {
                "type": "integer",
                "description": "0=None, 1=Lite, 2=Standard, 3=PRO",
                "x-parser-schema-id": "<anonymous-schema-110>"
              },
              "duration_months": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-111>"
              },
              "issued_by": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-112>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-107>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcAdminSetSubscriptionResponse",
        "message": {
          "name": "AdminSetSubscriptionResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-114>"
              },
              "subscription": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-115>"
                  },
                  "user_id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-116>"
                  },
                  "sub_type": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-117>"
                  },
                  "free_trial": {
                    "type": "boolean",
                    "x-parser-schema-id": "<anonymous-schema-118>"
                  },
                  "status": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-119>"
                  },
                  "started_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-120>"
                  },
                  "ended_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-121>"
                  },
                  "grace_period_end": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-122>"
                  },
                  "issued_by": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-123>"
                  },
                  "created_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-124>"
                  },
                  "updated_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-125>"
                  }
                },
                "x-parser-schema-id": "SubscriptionRecord"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-113>"
          }
        }
      }
    },
    "grpc/AdminRemoveSubscription": {
      "description": "Terminate a user's subscription — proxied to subscription-service",
      "publish": {
        "operationId": "grpcAdminRemoveSubscription",
        "summary": "Admin remove subscription",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "subscription"
          }
        ],
        "message": {
          "name": "AdminRemoveSubscriptionRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "user_id"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-127>"
              },
              "user_id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-128>"
              },
              "reason": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-129>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-126>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcAdminRemoveSubscriptionResponse",
        "message": {
          "name": "AdminRemoveSubscriptionResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-131>"
              },
              "message": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-132>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-130>"
          }
        }
      }
    },
    "grpc/GetSubscriptionStats": {
      "description": "Subscription stats by status and tier — proxied to subscription-service",
      "publish": {
        "operationId": "grpcGetSubscriptionStats",
        "summary": "Get subscription stats",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "subscription"
          }
        ],
        "message": {
          "name": "AdminGetSubscriptionStatsRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-134>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-133>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcGetSubscriptionStatsResponse",
        "message": {
          "name": "AdminSubscriptionStatsResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-136>"
              },
              "total_active": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-137>"
              },
              "total_expired": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-138>"
              },
              "total_canceled": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-139>"
              },
              "total_terminated": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-140>"
              },
              "by_tier": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "tier": {
                      "type": "integer",
                      "x-parser-schema-id": "<anonymous-schema-142>"
                    },
                    "count": {
                      "type": "integer",
                      "x-parser-schema-id": "<anonymous-schema-143>"
                    }
                  },
                  "x-parser-schema-id": "TierCount"
                },
                "x-parser-schema-id": "<anonymous-schema-141>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-135>"
          }
        }
      }
    },
    "grpc/CreatePromoCode": {
      "description": "Create a new promo code — proxied to subscription-service",
      "publish": {
        "operationId": "grpcCreatePromoCode",
        "summary": "Create promo code",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "promo"
          }
        ],
        "message": {
          "name": "AdminCreatePromoCodeRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "code",
              "discount_type",
              "discount_value"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-145>"
              },
              "code": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-146>"
              },
              "discount_type": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-147>"
              },
              "discount_value": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-148>"
              },
              "max_uses": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-149>"
              },
              "applicable_tiers": {
                "type": "array",
                "items": {
                  "type": "integer",
                  "x-parser-schema-id": "<anonymous-schema-151>"
                },
                "x-parser-schema-id": "<anonymous-schema-150>"
              },
              "min_duration_months": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-152>"
              },
              "valid_until": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-153>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-144>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcCreatePromoCodeResponse",
        "message": {
          "name": "AdminPromoCodeResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-155>"
              },
              "promo_code": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-156>"
                  },
                  "code": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-157>"
                  },
                  "discount_type": {
                    "type": "string",
                    "x-parser-schema-id": "<anonymous-schema-158>"
                  },
                  "discount_value": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-159>"
                  },
                  "max_uses": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-160>"
                  },
                  "used_count": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-161>"
                  },
                  "applicable_tiers": {
                    "type": "array",
                    "items": {
                      "type": "integer",
                      "x-parser-schema-id": "<anonymous-schema-163>"
                    },
                    "x-parser-schema-id": "<anonymous-schema-162>"
                  },
                  "min_duration_months": {
                    "type": "integer",
                    "x-parser-schema-id": "<anonymous-schema-164>"
                  },
                  "valid_from": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-165>"
                  },
                  "valid_until": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-166>"
                  },
                  "active": {
                    "type": "boolean",
                    "x-parser-schema-id": "<anonymous-schema-167>"
                  },
                  "created_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-168>"
                  },
                  "updated_at": {
                    "type": "string",
                    "format": "date-time",
                    "x-parser-schema-id": "<anonymous-schema-169>"
                  }
                },
                "x-parser-schema-id": "PromoCodeRecord"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-154>"
          }
        }
      }
    },
    "grpc/ListPromoCodes": {
      "description": "List promo codes — proxied to subscription-service",
      "publish": {
        "operationId": "grpcListPromoCodes",
        "summary": "List promo codes",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "promo"
          }
        ],
        "message": {
          "name": "AdminListPromoCodesRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-171>"
              },
              "page": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-172>"
              },
              "limit": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-173>"
              },
              "active_only": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-174>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-170>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcListPromoCodesResponse",
        "message": {
          "name": "AdminListPromoCodesResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-176>"
              },
              "promo_codes": {
                "type": "array",
                "items": "$ref:$.channels.grpc/CreatePromoCode.subscribe.message.payload.properties.promo_code",
                "x-parser-schema-id": "<anonymous-schema-177>"
              },
              "total": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-178>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-175>"
          }
        }
      }
    },
    "grpc/DeactivatePromoCode": {
      "description": "Deactivate a promo code — proxied to subscription-service",
      "publish": {
        "operationId": "grpcDeactivatePromoCode",
        "summary": "Deactivate promo code",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "promo"
          }
        ],
        "message": {
          "name": "AdminDeactivatePromoCodeRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "code"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-180>"
              },
              "code": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-181>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-179>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcDeactivatePromoCodeResponse",
        "message": {
          "name": "AdminDeactivatePromoCodeResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-183>"
              },
              "message": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-184>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-182>"
          }
        }
      }
    },
    "grpc/AdminSendNotification": {
      "description": "Send a notification to a single user — proxied to notification-service",
      "publish": {
        "operationId": "grpcAdminSendNotification",
        "summary": "Send notification",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "notification"
          }
        ],
        "message": {
          "name": "AdminSendNotificationRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "user_id",
              "email",
              "subject",
              "body"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-186>"
              },
              "user_id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-187>"
              },
              "email": {
                "type": "string",
                "format": "email",
                "x-parser-schema-id": "<anonymous-schema-188>"
              },
              "subject": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-189>"
              },
              "body": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-190>"
              },
              "channel": {
                "type": "string",
                "enum": [
                  "email",
                  "in_app"
                ],
                "default": "email",
                "x-parser-schema-id": "<anonymous-schema-191>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-185>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcAdminSendNotificationResponse",
        "message": {
          "name": "AdminSendNotificationResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-193>"
              },
              "message": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-194>"
              },
              "notification_id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-195>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-192>"
          }
        }
      }
    },
    "grpc/AdminSendBulkNotification": {
      "description": "Send notification to multiple users — fan-out via notification-service in batches of 50",
      "publish": {
        "operationId": "grpcAdminSendBulkNotification",
        "summary": "Send bulk notification",
        "tags": [
          {
            "name": "grpc"
          },
          {
            "name": "notification"
          }
        ],
        "message": {
          "name": "AdminSendBulkNotificationRequest",
          "payload": {
            "type": "object",
            "required": [
              "access_token",
              "subject",
              "body"
            ],
            "properties": {
              "access_token": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-197>"
              },
              "subject": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-198>"
              },
              "body": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-199>"
              },
              "channel": {
                "type": "string",
                "enum": [
                  "email",
                  "in_app"
                ],
                "default": "email",
                "x-parser-schema-id": "<anonymous-schema-200>"
              },
              "recipients": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "user_id": {
                      "type": "string",
                      "x-parser-schema-id": "<anonymous-schema-202>"
                    },
                    "email": {
                      "type": "string",
                      "format": "email",
                      "x-parser-schema-id": "<anonymous-schema-203>"
                    }
                  },
                  "x-parser-schema-id": "BulkRecipient"
                },
                "description": "Optional explicit list — if empty, sends to all users",
                "x-parser-schema-id": "<anonymous-schema-201>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-196>"
          }
        }
      },
      "subscribe": {
        "operationId": "grpcAdminSendBulkNotificationResponse",
        "message": {
          "name": "AdminSendBulkNotificationResponse",
          "payload": {
            "type": "object",
            "properties": {
              "success": {
                "type": "boolean",
                "x-parser-schema-id": "<anonymous-schema-205>"
              },
              "message": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-206>"
              },
              "total": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-207>"
              },
              "sent": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-208>"
              },
              "failed": {
                "type": "integer",
                "x-parser-schema-id": "<anonymous-schema-209>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-204>"
          }
        }
      }
    }
  },
  "components": {
    "messages": {
      "DashboardStatsRequest": "$ref:$.channels.grpc/GetDashboardStats.publish.message",
      "DashboardStatsResponse": "$ref:$.channels.grpc/GetDashboardStats.subscribe.message",
      "ListUsersRequest": "$ref:$.channels.grpc/ListUsers.publish.message",
      "ListUsersResponse": "$ref:$.channels.grpc/ListUsers.subscribe.message",
      "GetUserRequest": "$ref:$.channels.grpc/GetUser.publish.message",
      "GetUserResponse": "$ref:$.channels.grpc/GetUser.subscribe.message",
      "UpdateUserRoleRequest": "$ref:$.channels.grpc/UpdateUserRole.publish.message",
      "UpdateUserRoleResponse": "$ref:$.channels.grpc/UpdateUserRole.subscribe.message",
      "BanUserRequest": "$ref:$.channels.grpc/BanUser.publish.message",
      "BanUserResponse": "$ref:$.channels.grpc/BanUser.subscribe.message",
      "UnbanUserRequest": "$ref:$.channels.grpc/UnbanUser.publish.message",
      "UnbanUserResponse": "$ref:$.channels.grpc/UnbanUser.subscribe.message",
      "AdminCreateArticleRequest": "$ref:$.channels.grpc/CreateArticle.publish.message",
      "AdminArticleResponse": "$ref:$.channels.grpc/CreateArticle.subscribe.message",
      "AdminDeleteArticleRequest": "$ref:$.channels.grpc/DeleteArticle.publish.message",
      "AdminDeleteArticleResponse": "$ref:$.channels.grpc/DeleteArticle.subscribe.message",
      "AdminGetUploadUrlRequest": "$ref:$.channels.grpc/GetUploadUrl.publish.message",
      "AdminGetUploadUrlResponse": "$ref:$.channels.grpc/GetUploadUrl.subscribe.message",
      "AdminGetArticleStatsRequest": "$ref:$.channels.grpc/GetArticleStats.publish.message",
      "AdminArticleStatsResponse": "$ref:$.channels.grpc/GetArticleStats.subscribe.message",
      "AdminSetSubscriptionRequest": "$ref:$.channels.grpc/AdminSetSubscription.publish.message",
      "AdminSetSubscriptionResponse": "$ref:$.channels.grpc/AdminSetSubscription.subscribe.message",
      "AdminRemoveSubscriptionRequest": "$ref:$.channels.grpc/AdminRemoveSubscription.publish.message",
      "AdminRemoveSubscriptionResponse": "$ref:$.channels.grpc/AdminRemoveSubscription.subscribe.message",
      "AdminGetSubscriptionStatsRequest": "$ref:$.channels.grpc/GetSubscriptionStats.publish.message",
      "AdminSubscriptionStatsResponse": "$ref:$.channels.grpc/GetSubscriptionStats.subscribe.message",
      "AdminCreatePromoCodeRequest": "$ref:$.channels.grpc/CreatePromoCode.publish.message",
      "AdminPromoCodeResponse": "$ref:$.channels.grpc/CreatePromoCode.subscribe.message",
      "AdminListPromoCodesRequest": "$ref:$.channels.grpc/ListPromoCodes.publish.message",
      "AdminListPromoCodesResponse": "$ref:$.channels.grpc/ListPromoCodes.subscribe.message",
      "AdminDeactivatePromoCodeRequest": "$ref:$.channels.grpc/DeactivatePromoCode.publish.message",
      "AdminDeactivatePromoCodeResponse": "$ref:$.channels.grpc/DeactivatePromoCode.subscribe.message",
      "AdminSendNotificationRequest": "$ref:$.channels.grpc/AdminSendNotification.publish.message",
      "AdminSendNotificationResponse": "$ref:$.channels.grpc/AdminSendNotification.subscribe.message",
      "AdminSendBulkNotificationRequest": "$ref:$.channels.grpc/AdminSendBulkNotification.publish.message",
      "AdminSendBulkNotificationResponse": "$ref:$.channels.grpc/AdminSendBulkNotification.subscribe.message"
    },
    "schemas": {
      "UserRecord": "$ref:$.channels.grpc/ListUsers.subscribe.message.payload.properties.users.items",
      "PaginationMeta": "$ref:$.channels.grpc/ListUsers.subscribe.message.payload.properties.pagination",
      "ArticleRecord": "$ref:$.channels.grpc/CreateArticle.subscribe.message.payload.properties.article",
      "SubscriptionRecord": "$ref:$.channels.grpc/AdminSetSubscription.subscribe.message.payload.properties.subscription",
      "TierCount": "$ref:$.channels.grpc/GetSubscriptionStats.subscribe.message.payload.properties.by_tier.items",
      "PromoCodeRecord": "$ref:$.channels.grpc/CreatePromoCode.subscribe.message.payload.properties.promo_code",
      "BulkRecipient": "$ref:$.channels.grpc/AdminSendBulkNotification.publish.message.payload.properties.recipients.items"
    }
  },
  "x-parser-spec-parsed": true,
  "x-parser-api-version": 3,
  "x-parser-spec-stringified": true
};
    const config = {"show":{"sidebar":true},"sidebar":{"showOperations":"byDefault"}};
    const appRoot = document.getElementById('root');
    AsyncApiStandalone.render(
        { schema, config, }, appRoot
    );
  