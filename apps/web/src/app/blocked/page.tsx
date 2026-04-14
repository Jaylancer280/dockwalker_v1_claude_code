export default function BlockedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Account Suspended</h1>
        <p className="mt-4 text-muted-foreground">
          Your DockWalker account has been suspended. If you believe this is a mistake or want to
          discuss your account, please contact support.
        </p>
        <a
          href="mailto:support@dockwalker.com"
          className="mt-6 inline-block rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground"
        >
          Contact Support
        </a>
      </div>
    </div>
  );
}
