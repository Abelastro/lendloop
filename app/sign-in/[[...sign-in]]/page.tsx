import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";

export default function SignInPage() {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mx-auto mb-9 flex w-fit items-center gap-2 text-lg font-semibold tracking-[-0.03em]"
        >
          <span className="bg-moss text-on-moss grid size-8 place-items-center rounded-full">
            <ArrowsClockwise size={18} weight="bold" />
          </span>
          LendLoop
        </Link>
        <div className="border-line bg-surface rounded-card border p-2 shadow-[0_20px_60px_-32px_rgba(23,32,25,0.35)]">
          <SignIn
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "w-full shadow-none",
                card: "bg-transparent shadow-none",
              },
            }}
          />
        </div>
        <p className="text-muted mt-5 text-center text-xs leading-5">
          Your email is only shown to people you borrow from or lend to.
        </p>
      </div>
    </main>
  );
}
