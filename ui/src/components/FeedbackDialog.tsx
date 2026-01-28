import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Image, X } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:8000';

interface FeedbackDialogProps {
  trigger?: React.ReactNode;
}

export function FeedbackDialog({ trigger }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setScreenshot(base64);
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    // Validate message
    const trimmedMessage = message.trim();
    if (!trimmedMessage || trimmedMessage.length < 5) {
      toast.error('Please enter a message (at least 5 characters)');
      return;
    }

    if (trimmedMessage.length > 2000) {
      toast.error('Message must not exceed 2000 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        message: trimmedMessage,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        ...(screenshot && { screenshot }),
      };

      const response = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        let errorMessage = 'Failed to send feedback';
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        // Handle rate limiting
        if (response.status === 429) {
          toast.error('Too many feedback submissions. Please wait a few minutes.');
        } else {
          toast.error(errorMessage);
        }
        return;
      }

      const result = await response.json();
      if (result.ok) {
        toast.success('Thanks — feedback sent');
        setOpen(false);
        setMessage('');
        setScreenshot(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        toast.error('Failed to send feedback');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <MessageSquare className="w-4 h-4 mr-2" />
            Send Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Help us improve by sharing your feedback, bug reports, or feature requests.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="Describe your feedback, bug report, or feature request..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="resize-none"
              disabled={isSubmitting}
              minLength={5}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/2000 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="screenshot">Screenshot (optional)</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                id="screenshot"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={isSubmitting}
                className="hidden"
              />
              {!screenshot ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  <Image className="w-4 h-4 mr-2" />
                  Add Screenshot
                </Button>
              ) : (
                <div className="flex items-center gap-2 w-full p-2 border rounded-md bg-muted/50">
                  <img
                    src={screenshot}
                    alt="Screenshot preview"
                    className="h-16 w-auto rounded object-contain"
                  />
                  <div className="flex-1 text-xs text-muted-foreground">
                    Screenshot attached
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveScreenshot}
                    disabled={isSubmitting}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Optional: Attach a screenshot to help us understand the issue (max 5MB)
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !message.trim() || message.trim().length < 5}>
            {isSubmitting ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

