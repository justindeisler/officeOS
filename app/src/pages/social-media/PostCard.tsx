/**
 * Social Media Post Card
 * Displays a post draft with preview, actions (approve, reject, edit, schedule, publish)
 */

import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Check,
  X,
  Pencil,
  Calendar,
  Send,
  Trash2,
  Linkedin,
  Instagram,
  Clock,
  Hash,
  Eye,
  MoreVertical,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SocialMediaPost } from "@/lib/api";

const statusConfig: Record<string, { label: string; color: string }> = {
  suggested: { label: "Suggested", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  approved: { label: "Approved", color: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" },
  scheduled: { label: "Scheduled", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  published: { label: "Published", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800" },
  rejected: { label: "Rejected", color: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" },
};

const sourceLabels: Record<string, string> = {
  commits: "Git Commits",
  conversations: "Conversations",
  news: "Tech News",
  manual: "Manual",
  topics: "Topic Research",
};

interface PostCardProps {
  post: SocialMediaPost;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (post: SocialMediaPost) => void;
  onSchedule: (post: SocialMediaPost) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PostCard({
  post,
  onApprove,
  onReject,
  onEdit,
  onSchedule,
  onPublish,
  onDelete,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const status = statusConfig[post.status] || statusConfig.suggested;
  const isLinkedIn = post.platform === "linkedin";
  const PlatformIcon = isLinkedIn ? Linkedin : Instagram;
  const truncatedText = post.content_text.length > 200 && !expanded
    ? post.content_text.slice(0, 200) + "..."
    : post.content_text;

  const hashtags = post.metadata?.hashtags || [];
  const topics = post.metadata?.topics || [];

  return (
    <Card className={cn(
      "group transition-all duration-200 hover:shadow-md",
      post.status === "rejected" && "opacity-60"
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header: Platform + Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg",
              isLinkedIn
                ? "bg-[#0077B5]/10 text-[#0077B5]"
                : "bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10 text-pink-600"
            )}>
              <PlatformIcon className="h-4 w-4" />
            </div>
            <Badge variant="outline" className={cn("text-xs font-medium", status.color)}>
              {status.label}
            </Badge>
            {post.source && (
              <Badge variant="secondary" className="text-xs">
                {sourceLabels[post.source] || post.source}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">
              {format(parseISO(post.created_at), "MMM d, yyyy")}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(post)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSchedule(post)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(post.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Visual preview */}
        {post.visual_path ? (
          <div className="rounded-lg overflow-hidden bg-muted border">
            <img
              src={`/api/social-media/visuals/${post.visual_path.split('/').pop()}`}
              alt={`${post.visual_type || "Visual"} for ${post.platform} post`}
              className="w-full aspect-video object-cover"
              loading="lazy"
              onError={(e) => {
                // Fallback to placeholder on load error
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                target.parentElement!.innerHTML = `
                  <div class="aspect-video flex items-center justify-center">
                    <span class="text-sm text-muted-foreground">⚠️ Visual unavailable</span>
                  </div>
                `;
              }}
            />
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden bg-muted/50 aspect-video flex items-center justify-center border border-dashed">
            <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
            <span className="ml-2 text-xs text-muted-foreground/50">No visual generated</span>
          </div>
        )}

        {/* Content text */}
        <div
          className={cn(
            "text-sm whitespace-pre-wrap leading-relaxed cursor-pointer",
            post.status === "rejected" && "line-through"
          )}
          onClick={() => setExpanded(!expanded)}
        >
          {truncatedText}
          {post.content_text.length > 200 && (
            <button
              className="ml-1 text-xs text-primary hover:underline font-medium"
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center text-xs text-primary/70 hover:text-primary"
              >
                <Hash className="h-3 w-3" />
                {tag.replace(/^#/, "")}
              </span>
            ))}
          </div>
        )}

        {/* Topics */}
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topics.map((topic) => (
              <Badge key={topic} variant="outline" className="text-[10px] font-normal">
                {topic}
              </Badge>
            ))}
          </div>
        )}

        {/* Scheduled date */}
        {post.scheduled_date && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Scheduled for {format(parseISO(post.scheduled_date), "EEEE, MMM d 'at' h:mm a")}
          </div>
        )}

        {/* Published date */}
        {post.published_date && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" />
            Published {format(parseISO(post.published_date), "MMM d, yyyy 'at' h:mm a")}
          </div>
        )}

        {/* Actions */}
        {post.status === "suggested" && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              className="h-8 text-xs bg-green-600 hover:bg-green-700"
              onClick={() => onApprove(post.id)}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => onEdit(post)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-destructive hover:text-destructive"
              onClick={() => onReject(post.id)}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Reject
            </Button>
          </div>
        )}

        {post.status === "approved" && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              className="h-8 text-xs"
              onClick={() => onSchedule(post)}
            >
              <Calendar className="h-3.5 w-3.5 mr-1" />
              Schedule
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => onPublish(post.id)}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Mark Published
            </Button>
          </div>
        )}

        {post.status === "scheduled" && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              className="h-8 text-xs"
              onClick={() => onPublish(post.id)}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Mark Published
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => onEdit(post)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          </div>
        )}

        {post.status === "rejected" && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => onApprove(post.id)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Reconsider
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
