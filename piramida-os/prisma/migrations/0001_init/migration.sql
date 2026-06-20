-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('ACTIVE', 'INVITED', 'PENDING_APPROVAL', 'DISABLED');

-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('STAFF', 'ORGANIZER');

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'EVENT_MANAGER', 'OPERATIONS_MANAGER', 'TECHNICIAN', 'EVENT_ORGANIZER');

-- CreateEnum
CREATE TYPE "EventRequestStatus" AS ENUM ('RECEIVED', 'PARSED', 'REVIEWED', 'PLANNING', 'PROPOSED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PLANNING', 'PROPOSED', 'CONFIRMED', 'PUBLISHED', 'LAUNCH_READY', 'LIVE', 'COMPLETED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'NEEDS_CHANGES', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('CONFERENCE', 'WORKSHOP', 'EXHIBITION', 'CONCERT', 'PRIVATE', 'CORPORATE', 'OTHER');

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PRIVATE', 'INTERNAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "SpaceKind" AS ENUM ('ROOM', 'CORRIDOR', 'ENTRANCE', 'HALL', 'STORAGE', 'TECH_ZONE', 'OUTDOOR', 'OTHER');

-- CreateEnum
CREATE TYPE "LocationKind" AS ENUM ('STORAGE_POINT', 'SCAN_POINT', 'STAGING', 'SHELF', 'DOCK', 'TECH_BOOTH', 'ZONE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetTrackingMode" AS ENUM ('SERIALIZED', 'BULK');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'SOFT_HOLD', 'RESERVED', 'PICKED', 'IN_TRANSIT', 'IN_USE', 'RETURNED', 'NEEDS_INSPECTION', 'MAINTENANCE', 'MISSING', 'RETIRED');

-- CreateEnum
CREATE TYPE "AssetCondition" AS ENUM ('EXCELLENT', 'GOOD', 'USABLE', 'NEEDS_INSPECTION', 'DAMAGED');

-- CreateEnum
CREATE TYPE "AssetVisibility" AS ENUM ('INTERNAL', 'STAFF_ONLY', 'PUBLIC_SAFE');

-- CreateEnum
CREATE TYPE "AssetReservationStatus" AS ENUM ('SOFT_HOLD', 'RESERVED', 'PICKED', 'IN_TRANSIT', 'IN_USE', 'RETURNED', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssetReservationItemStatus" AS ENUM ('PENDING', 'SOFT_HOLD', 'RESERVED', 'ASSIGNED', 'PICKED', 'IN_USE', 'RETURNED', 'RELEASED', 'SUBSTITUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssetMovementStatus" AS ENUM ('PLANNED', 'PICKED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssetIssueType" AS ENUM ('DAMAGE', 'LOSS', 'MALFUNCTION', 'INSPECTION', 'CLEANING', 'CALIBRATION');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'WONT_FIX');

-- CreateEnum
CREATE TYPE "ConflictType" AS ENUM ('SPACE_OVERLAP', 'ASSET_SHORTAGE', 'SERIALIZED_DOUBLE_BOOKING', 'SETUP_TEARDOWN_BUFFER', 'POWER_CABLE_RISK', 'GUEST_FLOW_RISK');

-- CreateEnum
CREATE TYPE "ConflictSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('OPEN', 'IGNORED', 'RESOLVED', 'AUTO_FIXED');

-- CreateEnum
CREATE TYPE "ConflictSuggestionType" AS ENUM ('SUBSTITUTE_ASSET', 'ADD_CABLE_KIT', 'ALTERNATIVE_SPACE', 'OVERFLOW_SPACE', 'INCREASE_BUFFER', 'ADD_CREW', 'REDUCE_QUANTITY');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'READY', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GuestRegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'WAITLISTED', 'CANCELLED', 'CHECKED_IN', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "GuestTicketStatus" AS ENUM ('REGISTERED', 'CANCELLED', 'CHECKED_IN', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "GuestCheckinStatus" AS ENUM ('CHECKED_IN', 'DUPLICATE', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "FileStorageProvider" AS ENUM ('LOCAL', 'SUPABASE', 'S3');

-- CreateEnum
CREATE TYPE "AttachmentOwnerType" AS ENUM ('EVENT_REQUEST', 'EVENT', 'PROPOSAL', 'QUOTE', 'ASSET', 'PROFILE', 'CLIENT', 'PUBLICATION', 'TASK', 'ASSET_ISSUE');

-- CreateEnum
CREATE TYPE "CommentOwnerType" AS ENUM ('EVENT_REQUEST', 'EVENT', 'CONFLICT', 'TASK', 'PROPOSAL', 'ASSET');

-- CreateEnum
CREATE TYPE "CommentVisibility" AS ENUM ('INTERNAL', 'STAFF_ONLY', 'ORGANIZER_SHARED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', 'APPROVE', 'REJECT', 'PUBLISH', 'RESERVE', 'RELEASE', 'CONFLICT_DETECTED', 'CONFLICT_RESOLVED', 'AUTO_FIX_APPLIED', 'PLAN_GENERATED', 'CHECK_IN', 'LAUNCH_OVERRIDE', 'AI_RUN', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'SECRET');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Tirane',
    "currency" TEXT NOT NULL DEFAULT 'ALL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "auth_user_id" UUID,
    "type" "ProfileType" NOT NULL,
    "status" "ProfileStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "full_name" TEXT NOT NULL,
    "display_name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "title" TEXT,
    "avatar_file_id" UUID,
    "contact_id" UUID,
    "last_active_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "code" "RoleCode" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_roles" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_by" TEXT,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "billing_email" TEXT,
    "tax_id" TEXT,
    "notes" TEXT,
    "status" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role_title" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_requests" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "submitted_by_profile_id" UUID,
    "title" TEXT,
    "raw_text" TEXT NOT NULL,
    "channel" TEXT,
    "status" "EventRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "approval_status" "EventApprovalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "extracted_json" JSONB,
    "confidence" DOUBLE PRECISION,
    "missing_fields" JSONB,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_request_messages" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "author_profile_id" UUID,
    "is_from_organizer" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_request_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "request_id" UUID,
    "client_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approval_status" "EventApprovalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "visibility" "EventVisibility" NOT NULL DEFAULT 'PRIVATE',
    "expected_guests" INTEGER,
    "event_start" TIMESTAMPTZ(6),
    "event_end" TIMESTAMPTZ(6),
    "setup_start" TIMESTAMPTZ(6),
    "teardown_end" TIMESTAMPTZ(6),
    "return_buffer_minutes" INTEGER,
    "summary" TEXT,
    "current_plan_version_id" UUID,
    "feasibility_score" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_requirements" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value_json" JSONB NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_approvals" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID,
    "event_request_id" UUID,
    "status" "EventApprovalStatus" NOT NULL,
    "decided_by_profile_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "reason" TEXT,
    "requested_changes" JSONB,
    "is_automated_draft" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_plan_versions" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_plan_diffs" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "from_version_id" UUID NOT NULL,
    "to_version_id" UUID NOT NULL,
    "diff" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_plan_diffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_request_id" UUID,
    "prompt_type" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "validation_passed" BOOLEAN NOT NULL DEFAULT false,
    "output_ref" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spaces" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "kind" "SpaceKind" NOT NULL,
    "capacity" INTEGER,
    "standing_capacity" INTEGER,
    "comfort_flow" INTEGER,
    "floor" INTEGER,
    "public_visible" BOOLEAN NOT NULL DEFAULT false,
    "staff_only" BOOLEAN NOT NULL DEFAULT true,
    "model_node_id" TEXT,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "z" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "depth" DOUBLE PRECISION,
    "sort_order" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_adjacencies" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "from_space_id" UUID NOT NULL,
    "to_space_id" UUID NOT NULL,
    "travel_label" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "space_adjacencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "space_id" UUID,
    "name" TEXT NOT NULL,
    "kind" "LocationKind" NOT NULL,
    "qr_code" TEXT,
    "model_node_id" TEXT,
    "floor" INTEGER,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "z" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "depth" DOUBLE PRECISION,
    "public_visible" BOOLEAN NOT NULL DEFAULT false,
    "staff_only" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "tracking_mode" "AssetTrackingMode" NOT NULL,
    "unit" TEXT,
    "default_visibility" "AssetVisibility" NOT NULL DEFAULT 'STAFF_ONLY',
    "default_setup_minutes" INTEGER NOT NULL DEFAULT 0,
    "default_teardown_minutes" INTEGER NOT NULL DEFAULT 0,
    "default_return_buffer_minutes" INTEGER NOT NULL DEFAULT 30,
    "replacement_category_id" UUID,
    "icon" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "asset_tag" TEXT NOT NULL,
    "qr_code" TEXT,
    "serial_number" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'STAFF_ONLY',
    "home_location_id" UUID,
    "current_location_id" UUID,
    "setup_minutes" INTEGER,
    "teardown_minutes" INTEGER,
    "return_buffer_minutes" INTEGER,
    "purchase_date" TIMESTAMPTZ(6),
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_batches" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "home_location_id" UUID,
    "total_quantity" INTEGER NOT NULL,
    "available_quantity" INTEGER NOT NULL,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "damaged_quantity" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT,
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'STAFF_ONLY',
    "setup_minutes" INTEGER,
    "teardown_minutes" INTEGER,
    "return_buffer_minutes" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "asset_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_kits" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "asset_kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_kit_items" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "kit_id" UUID NOT NULL,
    "category_id" UUID,
    "asset_id" UUID,
    "batch_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER,

    CONSTRAINT "asset_kit_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "space_reservations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "space_id" UUID NOT NULL,
    "status" "AssetReservationStatus" NOT NULL DEFAULT 'SOFT_HOLD',
    "setup_start" TIMESTAMPTZ(6) NOT NULL,
    "event_start" TIMESTAMPTZ(6) NOT NULL,
    "event_end" TIMESTAMPTZ(6) NOT NULL,
    "teardown_end" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "space_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_reservations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "status" "AssetReservationStatus" NOT NULL DEFAULT 'SOFT_HOLD',
    "setup_start" TIMESTAMPTZ(6) NOT NULL,
    "event_start" TIMESTAMPTZ(6) NOT NULL,
    "event_end" TIMESTAMPTZ(6) NOT NULL,
    "teardown_end" TIMESTAMPTZ(6) NOT NULL,
    "return_buffer_minutes" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "asset_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_reservation_items" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "category_id" UUID,
    "asset_id" UUID,
    "batch_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "item_status" "AssetReservationItemStatus" NOT NULL DEFAULT 'PENDING',
    "source_kit_id" UUID,
    "replaces_item_id" UUID,
    "window_start" TIMESTAMPTZ(6),
    "window_end" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "asset_reservation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_movements" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "asset_id" UUID,
    "batch_id" UUID,
    "reservation_item_id" UUID,
    "quantity" INTEGER,
    "from_location_id" UUID,
    "to_location_id" UUID,
    "status" "AssetMovementStatus" NOT NULL DEFAULT 'PLANNED',
    "scanned_by_profile_id" UUID,
    "scanned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "asset_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_issues" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "asset_id" UUID,
    "batch_id" UUID,
    "type" "AssetIssueType" NOT NULL,
    "maintenance_status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "severity" TEXT,
    "description" TEXT NOT NULL,
    "reported_by_profile_id" UUID,
    "assigned_to_profile_id" UUID,
    "reported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "cost" DECIMAL(12,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "asset_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflicts" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "type" "ConflictType" NOT NULL,
    "severity" "ConflictSeverity" NOT NULL,
    "status" "ConflictStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by_profile_id" UUID,
    "resolution_note" TEXT,
    "plan_version_id" UUID,

    CONSTRAINT "conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflict_suggestions" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "conflict_id" UUID NOT NULL,
    "type" "ConflictSuggestionType" NOT NULL,
    "label" TEXT NOT NULL,
    "rationale" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "is_applied" BOOLEAN NOT NULL DEFAULT false,
    "applied_at" TIMESTAMPTZ(6),
    "applied_by_profile_id" UUID,
    "rank" INTEGER,

    CONSTRAINT "conflict_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assigned_to_profile_id" UUID,
    "space_id" UUID,
    "location_id" UUID,
    "due_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "source" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "depends_on_task_id" UUID NOT NULL,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'ALL',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valid_until" TIMESTAMPTZ(6),
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "source_ref" TEXT,
    "sort_order" INTEGER,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "quote_id" UUID,
    "client_id" UUID NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "shared_with_contact_id" UUID,
    "sent_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "response_note" TEXT,
    "pdf_file_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_publications" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "public_title" TEXT NOT NULL,
    "public_description" TEXT,
    "hero_file_id" UUID,
    "public_start" TIMESTAMPTZ(6),
    "public_end" TIMESTAMPTZ(6),
    "venue_label" TEXT,
    "registration_open" BOOLEAN NOT NULL DEFAULT false,
    "capacity_public" INTEGER,
    "agenda" JSONB NOT NULL DEFAULT '[]',
    "public_map" JSONB NOT NULL DEFAULT '{}',
    "published_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "event_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT,
    "profile_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_registrations" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "status" "GuestRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "guest_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_tickets" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "status" "GuestTicketStatus" NOT NULL DEFAULT 'REGISTERED',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guest_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_checkins" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "status" "GuestCheckinStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "scanned_by_profile_id" UUID,
    "scanned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gate_label" TEXT,

    CONSTRAINT "guest_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_objects" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "storage_provider" "FileStorageProvider" NOT NULL DEFAULT 'LOCAL',
    "relative_path" TEXT NOT NULL,
    "public_url" TEXT,
    "original_name" TEXT,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "file_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "owner_type" "AttachmentOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "owner_type" "CommentOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "author_profile_id" UUID,
    "visibility" "CommentVisibility" NOT NULL DEFAULT 'INTERNAL',
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "actor_profile_id" UUID,
    "action" "AuditAction" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "value_type" "SettingValueType" NOT NULL,
    "description" TEXT,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_auth_user_id_key" ON "profiles"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_contact_id_key" ON "profiles"("contact_id");

-- CreateIndex
CREATE INDEX "profiles_org_id_type_idx" ON "profiles"("org_id", "type");

-- CreateIndex
CREATE INDEX "profiles_org_id_status_idx" ON "profiles"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_org_id_email_key" ON "profiles"("org_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_org_id_code_key" ON "roles"("org_id", "code");

-- CreateIndex
CREATE INDEX "profile_roles_org_id_idx" ON "profile_roles"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "profile_roles_profile_id_role_id_key" ON "profile_roles"("profile_id", "role_id");

-- CreateIndex
CREATE INDEX "clients_org_id_idx" ON "clients"("org_id");

-- CreateIndex
CREATE INDEX "contacts_org_id_client_id_idx" ON "contacts"("org_id", "client_id");

-- CreateIndex
CREATE INDEX "event_requests_org_id_status_idx" ON "event_requests"("org_id", "status");

-- CreateIndex
CREATE INDEX "event_requests_org_id_client_id_idx" ON "event_requests"("org_id", "client_id");

-- CreateIndex
CREATE INDEX "event_request_messages_org_id_request_id_idx" ON "event_request_messages"("org_id", "request_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_request_id_key" ON "events"("request_id");

-- CreateIndex
CREATE INDEX "events_org_id_status_idx" ON "events"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "events_org_id_code_key" ON "events"("org_id", "code");

-- CreateIndex
CREATE INDEX "event_requirements_org_id_event_id_idx" ON "event_requirements"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "event_approvals_org_id_event_id_idx" ON "event_approvals"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "event_plan_versions_org_id_event_id_idx" ON "event_plan_versions"("org_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_plan_versions_event_id_version_key" ON "event_plan_versions"("event_id", "version");

-- CreateIndex
CREATE INDEX "event_plan_diffs_org_id_idx" ON "event_plan_diffs"("org_id");

-- CreateIndex
CREATE INDEX "ai_runs_org_id_prompt_type_idx" ON "ai_runs"("org_id", "prompt_type");

-- CreateIndex
CREATE INDEX "spaces_org_id_kind_idx" ON "spaces"("org_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "spaces_org_id_name_key" ON "spaces"("org_id", "name");

-- CreateIndex
CREATE INDEX "space_adjacencies_org_id_idx" ON "space_adjacencies"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "space_adjacencies_from_space_id_to_space_id_key" ON "space_adjacencies"("from_space_id", "to_space_id");

-- CreateIndex
CREATE INDEX "locations_org_id_kind_idx" ON "locations"("org_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "locations_org_id_qr_code_key" ON "locations"("org_id", "qr_code");

-- CreateIndex
CREATE INDEX "asset_categories_org_id_tracking_mode_idx" ON "asset_categories"("org_id", "tracking_mode");

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_org_id_name_key" ON "asset_categories"("org_id", "name");

-- CreateIndex
CREATE INDEX "assets_org_id_category_id_idx" ON "assets"("org_id", "category_id");

-- CreateIndex
CREATE INDEX "assets_org_id_status_idx" ON "assets"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "assets_org_id_asset_tag_key" ON "assets"("org_id", "asset_tag");

-- CreateIndex
CREATE UNIQUE INDEX "assets_org_id_qr_code_key" ON "assets"("org_id", "qr_code");

-- CreateIndex
CREATE INDEX "asset_batches_org_id_category_id_idx" ON "asset_batches"("org_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_kits_org_id_name_key" ON "asset_kits"("org_id", "name");

-- CreateIndex
CREATE INDEX "asset_kit_items_org_id_kit_id_idx" ON "asset_kit_items"("org_id", "kit_id");

-- CreateIndex
CREATE INDEX "space_reservations_org_id_event_id_idx" ON "space_reservations"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "space_reservations_space_id_setup_start_teardown_end_idx" ON "space_reservations"("space_id", "setup_start", "teardown_end");

-- CreateIndex
CREATE INDEX "asset_reservations_org_id_event_id_idx" ON "asset_reservations"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "asset_reservations_org_id_status_idx" ON "asset_reservations"("org_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "asset_reservation_items_replaces_item_id_key" ON "asset_reservation_items"("replaces_item_id");

-- CreateIndex
CREATE INDEX "asset_reservation_items_org_id_reservation_id_idx" ON "asset_reservation_items"("org_id", "reservation_id");

-- CreateIndex
CREATE INDEX "asset_reservation_items_asset_id_window_start_window_end_idx" ON "asset_reservation_items"("asset_id", "window_start", "window_end");

-- CreateIndex
CREATE INDEX "asset_movements_org_id_asset_id_idx" ON "asset_movements"("org_id", "asset_id");

-- CreateIndex
CREATE INDEX "asset_issues_org_id_maintenance_status_idx" ON "asset_issues"("org_id", "maintenance_status");

-- CreateIndex
CREATE INDEX "conflicts_org_id_event_id_idx" ON "conflicts"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "conflicts_org_id_status_idx" ON "conflicts"("org_id", "status");

-- CreateIndex
CREATE INDEX "conflict_suggestions_org_id_conflict_id_idx" ON "conflict_suggestions"("org_id", "conflict_id");

-- CreateIndex
CREATE INDEX "tasks_org_id_status_idx" ON "tasks"("org_id", "status");

-- CreateIndex
CREATE INDEX "tasks_org_id_event_id_idx" ON "tasks"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "task_dependencies_org_id_idx" ON "task_dependencies"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_task_id_depends_on_task_id_key" ON "task_dependencies"("task_id", "depends_on_task_id");

-- CreateIndex
CREATE INDEX "quotes_org_id_event_id_idx" ON "quotes"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "quote_items_org_id_quote_id_idx" ON "quote_items"("org_id", "quote_id");

-- CreateIndex
CREATE INDEX "proposals_org_id_event_id_idx" ON "proposals"("org_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_publications_event_id_key" ON "event_publications"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_publications_slug_key" ON "event_publications"("slug");

-- CreateIndex
CREATE INDEX "event_publications_org_id_status_idx" ON "event_publications"("org_id", "status");

-- CreateIndex
CREATE INDEX "event_participants_org_id_event_id_idx" ON "event_participants"("org_id", "event_id");

-- CreateIndex
CREATE INDEX "guest_registrations_org_id_publication_id_idx" ON "guest_registrations"("org_id", "publication_id");

-- CreateIndex
CREATE INDEX "guest_registrations_publication_id_email_idx" ON "guest_registrations"("publication_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "guest_tickets_registration_id_key" ON "guest_tickets"("registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_tickets_token_key" ON "guest_tickets"("token");

-- CreateIndex
CREATE INDEX "guest_tickets_org_id_idx" ON "guest_tickets"("org_id");

-- CreateIndex
CREATE INDEX "guest_checkins_org_id_ticket_id_idx" ON "guest_checkins"("org_id", "ticket_id");

-- CreateIndex
CREATE INDEX "file_objects_org_id_idx" ON "file_objects"("org_id");

-- CreateIndex
CREATE INDEX "attachments_org_id_owner_type_owner_id_idx" ON "attachments"("org_id", "owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "comments_org_id_owner_type_owner_id_idx" ON "comments"("org_id", "owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_entity_type_entity_id_idx" ON "audit_logs"("org_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_action_idx" ON "audit_logs"("org_id", "action");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_org_id_key_key" ON "app_settings"("org_id", "key");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_roles" ADD CONSTRAINT "profile_roles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_roles" ADD CONSTRAINT "profile_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_requests" ADD CONSTRAINT "event_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_requests" ADD CONSTRAINT "event_requests_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_request_messages" ADD CONSTRAINT "event_request_messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "event_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "event_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_requirements" ADD CONSTRAINT "event_requirements_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_approvals" ADD CONSTRAINT "event_approvals_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_plan_versions" ADD CONSTRAINT "event_plan_versions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_plan_diffs" ADD CONSTRAINT "event_plan_diffs_from_version_id_fkey" FOREIGN KEY ("from_version_id") REFERENCES "event_plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_plan_diffs" ADD CONSTRAINT "event_plan_diffs_to_version_id_fkey" FOREIGN KEY ("to_version_id") REFERENCES "event_plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_event_request_id_fkey" FOREIGN KEY ("event_request_id") REFERENCES "event_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_adjacencies" ADD CONSTRAINT "space_adjacencies_from_space_id_fkey" FOREIGN KEY ("from_space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_adjacencies" ADD CONSTRAINT "space_adjacencies_to_space_id_fkey" FOREIGN KEY ("to_space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_replacement_category_id_fkey" FOREIGN KEY ("replacement_category_id") REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_home_location_id_fkey" FOREIGN KEY ("home_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_current_location_id_fkey" FOREIGN KEY ("current_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_batches" ADD CONSTRAINT "asset_batches_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_batches" ADD CONSTRAINT "asset_batches_home_location_id_fkey" FOREIGN KEY ("home_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_kit_items" ADD CONSTRAINT "asset_kit_items_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "asset_kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_kit_items" ADD CONSTRAINT "asset_kit_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_kit_items" ADD CONSTRAINT "asset_kit_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_kit_items" ADD CONSTRAINT "asset_kit_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "asset_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_reservations" ADD CONSTRAINT "space_reservations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "space_reservations" ADD CONSTRAINT "space_reservations_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_reservations" ADD CONSTRAINT "asset_reservations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_reservation_items" ADD CONSTRAINT "asset_reservation_items_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "asset_reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_reservation_items" ADD CONSTRAINT "asset_reservation_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_reservation_items" ADD CONSTRAINT "asset_reservation_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_reservation_items" ADD CONSTRAINT "asset_reservation_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "asset_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_reservation_items" ADD CONSTRAINT "asset_reservation_items_replaces_item_id_fkey" FOREIGN KEY ("replaces_item_id") REFERENCES "asset_reservation_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "asset_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_reservation_item_id_fkey" FOREIGN KEY ("reservation_item_id") REFERENCES "asset_reservation_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_movements" ADD CONSTRAINT "asset_movements_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_issues" ADD CONSTRAINT "asset_issues_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_issues" ADD CONSTRAINT "asset_issues_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "asset_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_suggestions" ADD CONSTRAINT "conflict_suggestions_conflict_id_fkey" FOREIGN KEY ("conflict_id") REFERENCES "conflicts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_fkey" FOREIGN KEY ("depends_on_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_shared_with_contact_id_fkey" FOREIGN KEY ("shared_with_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_publications" ADD CONSTRAINT "event_publications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_registrations" ADD CONSTRAINT "guest_registrations_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "event_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_tickets" ADD CONSTRAINT "guest_tickets_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "guest_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_checkins" ADD CONSTRAINT "guest_checkins_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "guest_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

