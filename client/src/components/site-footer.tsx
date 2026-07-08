// Small always-on footer with crisis links and a "not medical advice" note.
// Present on every authenticated page.

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Quiet Hours is a tool, not a substitute for care. Not medical advice.
        </p>
        <p>
          Crisis? US:{" "}
          <a
            href="tel:988"
            className="text-accent-foreground underline underline-offset-2"
          >
            988
          </a>
          {" · "}
          <a
            href="sms:741741&body=HOME"
            className="text-accent-foreground underline underline-offset-2"
          >
            text HOME to 741741
          </a>
          {" · "}
          <a
            href="https://findahelpline.com"
            target="_blank"
            rel="noreferrer"
            className="text-accent-foreground underline underline-offset-2"
          >
            findahelpline.com
          </a>
        </p>
      </div>
    </footer>
  );
}
