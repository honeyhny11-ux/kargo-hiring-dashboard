"use client";

import { useFormStatus } from "react-dom";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: string };

/** Submit button that disables itself while its form's server action runs. */
export default function SubmitButton({ pending, children, ...rest }: Props) {
  const status = useFormStatus();
  return (
    <button type="submit" disabled={status.pending} {...rest}>
      {status.pending && pending ? pending : children}
    </button>
  );
}
