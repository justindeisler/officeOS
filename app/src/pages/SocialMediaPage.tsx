/**
 * Social Media Management Page
 * LinkedIn & Instagram content pipeline with suggested posts + posting calendar
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Linkedin,
  Instagram,
  Plus,
  RefreshCw,
  Filter,
  LayoutGrid,
  Calendar as CalendarIcon,
  BarChart3,
  Sparkles,
  Send,
  Clock,
  FileText,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { SocialMediaPost, CreateSocialMediaPost } from "@/lib/api";
import { PostCard } from "./social-media/PostCard";
import { PostDialog } from "./social-media/PostDialog";
import { ScheduleDialog } from "./social-media/ScheduleDialog";
import { PostingCalendar } from "./social-media/PostingCalendar";

type ViewTab = "posts" | "calendar";
type StatusFilter = "all" | "suggested" | "approved" | "scheduled" | "published" | "rejected";

export function SocialMediaPage() {
  const [platform, setPlatform] = useState<"linkedin" | "instagram">("linkedin");
  const [viewTab, setViewTab] = useState<ViewTab>("posts");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialMediaPost | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [schedulingPost, setSchedulingPost] = useState<SocialMediaPost | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSocialMediaPosts({
        platform,
        status: statusFilter !== "all" ? statusFilter : undefined,
        limit: 200,
      });
      setPosts(data);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [platform, statusFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Stats
  const stats = useMemo(() => {
    const all = posts;
    return {
      suggested: all.filter((p) => p.status === "suggested").length,
      approved: all.filter((p) => p.status === "approved").length,
      scheduled: all.filter((p) => p.status === "scheduled").length,
      published: all.filter((p) => p.status === "published").length,
    };
  }, [posts]);

  // Filtered posts for different sections
  const suggestedPosts = useMemo(
    () => posts.filter((p) => p.status === "suggested"),
    [posts]
  );
  const approvedPosts = useMemo(
    () => posts.filter((p) => p.status === "approved"),
    [posts]
  );
  const scheduledPosts = useMemo(
    () => posts.filter((p) => p.status === "scheduled" || p.status === "published"),
    [posts]
  );

  // Actions
  const handleApprove = async (id: string) => {
    try {
      await api.updateSocialMediaPost(id, { status: "approved" });
      toast.success("Post approved!");
      fetchPosts();
    } catch {
      toast.error("Failed to approve post");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.updateSocialMediaPost(id, { status: "rejected" });
      toast("Post rejected", { icon: "🗑️" });
      fetchPosts();
    } catch {
      toast.error("Failed to reject post");
    }
  };

  const handleEdit = (post: SocialMediaPost) => {
    setEditingPost(post);
    setEditDialogOpen(true);
  };

  const handleSchedule = (post: SocialMediaPost) => {
    setSchedulingPost(post);
    setScheduleDialogOpen(true);
  };

  const handlePublish = async (id: string) => {
    try {
      await api.publishSocialMediaPost(id);
      toast.success("Post marked as published! 🎉");
      fetchPosts();
    } catch {
      toast.error("Failed to publish post");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSocialMediaPost(id);
      toast("Post deleted");
      fetchPosts();
    } catch {
      toast.error("Failed to delete post");
    }
  };

  const handleSaveEdit = async (data: CreateSocialMediaPost & { status?: string }) => {
    if (editingPost) {
      await api.updateSocialMediaPost(editingPost.id, data);
      toast.success("Post updated!");
    }
    fetchPosts();
  };

  const handleCreate = async (data: CreateSocialMediaPost) => {
    await api.createSocialMediaPost(data);
    toast.success("Draft created!");
    fetchPosts();
  };

  const handleScheduleConfirm = async (id: string, date: string) => {
    await api.updateSocialMediaPost(id, { status: "scheduled", scheduled_date: date } as never);
    toast.success("Post scheduled!");
    fetchPosts();
  };

  const handleCalendarPostClick = (post: SocialMediaPost) => {
    handleEdit(post);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Social Media</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your LinkedIn & Instagram content pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPosts}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingPost(null);
              setCreateDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Post
          </Button>
        </div>
      </div>

      {/* Platform tabs */}
      <Tabs
        value={platform}
        onValueChange={(v) => setPlatform(v as "linkedin" | "instagram")}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="h-11">
            <TabsTrigger value="linkedin" className="gap-2 px-4">
              <Linkedin className="h-4 w-4" />
              LinkedIn
              {stats.suggested > 0 && platform !== "linkedin" && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {stats.suggested}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="instagram" className="gap-2 px-4">
              <Instagram className="h-4 w-4" />
              Instagram
            </TabsTrigger>
          </TabsList>

          {/* View toggle */}
          <div className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 rounded-r-none ${viewTab === "posts" ? "bg-muted" : ""}`}
              onClick={() => setViewTab("posts")}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Posts
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-8 rounded-l-none ${viewTab === "calendar" ? "bg-muted" : ""}`}
              onClick={() => setViewTab("calendar")}
            >
              <CalendarIcon className="h-4 w-4 mr-1" />
              Calendar
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setStatusFilter("suggested")}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10">
                <Sparkles className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.suggested}</p>
                <p className="text-[11px] text-muted-foreground">Suggested</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setStatusFilter("approved")}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-500/10">
                <FileText className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-[11px] text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setStatusFilter("scheduled")}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.scheduled}</p>
                <p className="text-[11px] text-muted-foreground">Scheduled</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setStatusFilter("published")}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/10">
                <Send className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.published}</p>
                <p className="text-[11px] text-muted-foreground">Published</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content for both platforms */}
        <TabsContent value="linkedin" className="mt-4">
          {viewTab === "posts" ? (
            <PostsView
              posts={statusFilter === "all" ? posts : posts.filter((p) => p.status === statusFilter)}
              suggestedPosts={suggestedPosts}
              approvedPosts={approvedPosts}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              loading={loading}
              onApprove={handleApprove}
              onReject={handleReject}
              onEdit={handleEdit}
              onSchedule={handleSchedule}
              onPublish={handlePublish}
              onDelete={handleDelete}
            />
          ) : (
            <PostingCalendar
              posts={scheduledPosts}
              onPostClick={handleCalendarPostClick}
            />
          )}
        </TabsContent>

        <TabsContent value="instagram" className="mt-4">
          {viewTab === "posts" ? (
            <PostsView
              posts={statusFilter === "all" ? posts : posts.filter((p) => p.status === statusFilter)}
              suggestedPosts={suggestedPosts}
              approvedPosts={approvedPosts}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              loading={loading}
              onApprove={handleApprove}
              onReject={handleReject}
              onEdit={handleEdit}
              onSchedule={handleSchedule}
              onPublish={handlePublish}
              onDelete={handleDelete}
            />
          ) : (
            <PostingCalendar
              posts={scheduledPosts}
              onPostClick={handleCalendarPostClick}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <PostDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        post={editingPost}
        onSave={handleSaveEdit}
        defaultPlatform={platform}
      />
      <PostDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        post={null}
        onSave={handleCreate}
        defaultPlatform={platform}
      />
      <ScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        post={schedulingPost}
        onSchedule={handleScheduleConfirm}
      />
    </div>
  );
}

// ─── Posts View (grid of cards) ────────────────────────────────────

interface PostsViewProps {
  posts: SocialMediaPost[];
  suggestedPosts: SocialMediaPost[];
  approvedPosts: SocialMediaPost[];
  statusFilter: StatusFilter;
  setStatusFilter: (f: StatusFilter) => void;
  loading: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (post: SocialMediaPost) => void;
  onSchedule: (post: SocialMediaPost) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
}

function PostsView({
  posts,
  suggestedPosts,
  approvedPosts,
  statusFilter,
  setStatusFilter,
  loading,
  onApprove,
  onReject,
  onEdit,
  onSchedule,
  onPublish,
  onDelete,
}: PostsViewProps) {
  // Status filter pills
  const filters: { value: StatusFilter; label: string; count?: number }[] = [
    { value: "all", label: "All", count: posts.length },
    { value: "suggested", label: "Suggested" },
    { value: "approved", label: "Approved" },
    { value: "scheduled", label: "Scheduled" },
    { value: "published", label: "Published" },
    { value: "rejected", label: "Rejected" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts grid */}
      {posts.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Sparkles className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <div>
            <p className="font-medium text-muted-foreground">No posts yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Create a new post or wait for James to generate suggestions
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onApprove={onApprove}
              onReject={onReject}
              onEdit={onEdit}
              onSchedule={onSchedule}
              onPublish={onPublish}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
