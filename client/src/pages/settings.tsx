import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { exportAllMyData, deleteAllMyData } from "@/lib/data";
import { CheckInCadenceCard } from "@/components/checkin-cadence-card";
import { queryClient } from "@/lib/queryClient";
import { Download, LogOut, Trash2 } from "lucide-react";

export default function Settings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      const data = await exportAllMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `quiet-hours-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Exported. Your data is now on your device." });
    } catch (e) {
      toast({ title: "Export failed", description: String(e) });
    } finally {
      setExporting(false);
    }
  };

  const onDeleteAll = async () => {
    setDeleting(true);
    try {
      await deleteAllMyData();
      queryClient.clear();
      // Auth listener will flip us back to the sign-in page.
    } catch (e) {
      toast({ title: "Delete failed", description: String(e) });
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        subtitle="This is your account and your data. Take it, leave it, delete it."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Signed in as
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p
            className="font-serif text-base text-foreground"
            data-testid="text-email"
          >
            {user?.email ?? "\u2014"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut()}
            data-testid="button-sign-out"
          >
            <LogOut className="mr-1.5 h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>

      <CheckInCadenceCard />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Your data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-serif text-sm italic text-muted-foreground">
            Everything you've logged — check-ins, tasks, checklists,
            compassion entries — is stored in a private database only you
            can read. You can take a copy with you at any time.
          </p>
          <Button
            variant="outline"
            onClick={onExport}
            disabled={exporting}
            data-testid="button-export"
          >
            <Download className="mr-1.5 h-4 w-4" />
            {exporting ? "Exporting\u2026" : "Export my data (JSON)"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Delete everything
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-serif text-sm italic text-muted-foreground">
            This removes every task, checklist, compassion entry, and burnout
            check-in tied to your account. It cannot be undone. You'll be
            signed out.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="button-delete-all">
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete my data and sign
                me out
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-serif">
                  Delete everything?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Every row you've logged will be permanently removed. Consider
                  exporting first if there's anything you'd want to keep.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-delete-cancel">
                  Keep my data
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDeleteAll}
                  disabled={deleting}
                  data-testid="button-delete-confirm"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Deleting\u2026" : "Yes, delete everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            If it's not okay
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="font-serif text-sm italic text-muted-foreground">
            This app is a tool, not a substitute for care. If you're in crisis
            or things feel unmanageable, please reach out.
          </p>
          <ul className="space-y-1 text-sm text-foreground">
            <li>
              <span className="text-muted-foreground">US:</span> call or text{" "}
              <a
                href="tel:988"
                className="text-accent-foreground underline underline-offset-2"
              >
                988
              </a>{" "}
              (Suicide & Crisis Lifeline)
            </li>
            <li>
              <span className="text-muted-foreground">Text-based:</span>{" "}
              <a
                href="sms:741741&body=HOME"
                className="text-accent-foreground underline underline-offset-2"
              >
                Text HOME to 741741
              </a>{" "}
              (Crisis Text Line)
            </li>
            <li>
              <span className="text-muted-foreground">Global:</span>{" "}
              <a
                href="https://findahelpline.com"
                target="_blank"
                rel="noreferrer"
                className="text-accent-foreground underline underline-offset-2"
              >
                findahelpline.com
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
