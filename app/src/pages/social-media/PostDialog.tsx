/**
 * Dialog for creating/editing a social media post
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Linkedin, Instagram } from "lucide-react";
import type { SocialMediaPost, CreateSocialMediaPost } from "@/lib/api";

interface PostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: SocialMediaPost | null;
  onSave: (data: CreateSocialMediaPost & { status?: string }) => Promise<void>;
  defaultPlatform?: "linkedin" | "instagram";
}

export function PostDialog({
  open,
  onOpenChange,
  post,
  onSave,
  defaultPlatform = "linkedin",
}: PostDialogProps) {
  const [platform, setPlatform] = useState<"linkedin" | "instagram">(defaultPlatform);
  const [contentText, setContentText] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [source, setSource] = useState("manual");
  const [saving, setSaving] = useState(false);

  const isEditing = !!post;

  useEffect(() => {
    if (post) {
      setPlatform(post.platform);
      setContentText(post.content_text);
      setHashtags((post.metadata?.hashtags || []).join(", "));
      setSource(post.source || "manual");
    } else {
      setPlatform(defaultPlatform);
      setContentText("");
      setHashtags("");
      setSource("manual");
    }
  }, [post, defaultPlatform, open]);

  const charCount = contentText.length;
  const maxChars = platform === "linkedin" ? 3000 : 2200;
  const isOverLimit = charCount > maxChars;

  const handleSave = async () => {
    if (!contentText.trim() || isOverLimit) return;
    setSaving(true);
    try {
      const hashtagList = hashtags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t.startsWith("#") ? t : `#${t}`));

      await onSave({
        platform,
        content_text: contentText.trim(),
        source,
        metadata: hashtagList.length > 0 ? { hashtags: hashtagList } : undefined,
        ...(isEditing ? { status: post.status } : {}),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Post" : "Create Post"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Edit the content and settings for this post."
              : "Create a new social media post draft."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Platform */}
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select
              value={platform}
              onValueChange={(v) => setPlatform(v as "linkedin" | "instagram")}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linkedin">
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-[#0077B5]" />
                    LinkedIn
                  </div>
                </SelectItem>
                <SelectItem value="instagram">
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-pink-600" />
                    Instagram
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Content</Label>
              <span className={`text-xs ${isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                {charCount}/{maxChars}
              </span>
            </div>
            <Textarea
              placeholder={
                platform === "linkedin"
                  ? "Write your LinkedIn post...\n\nProfessional tone, 1-3 paragraphs, include insights..."
                  : "Write your Instagram caption...\n\nConcise, visual-first, emojis welcome ✨"
              }
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              rows={8}
              className="resize-none font-mono text-sm"
            />
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <Label>Hashtags (comma-separated)</Label>
            <Input
              placeholder="#AI, #TypeScript, #Healthtech, #FreelanceDev"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="commits">Git Commits</SelectItem>
                <SelectItem value="conversations">Conversations</SelectItem>
                <SelectItem value="news">Tech News</SelectItem>
                <SelectItem value="topics">Topic Research</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!contentText.trim() || isOverLimit || saving}
          >
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
