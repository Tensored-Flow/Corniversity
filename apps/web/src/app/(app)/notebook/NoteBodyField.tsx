"use client";

import { type ChangeEvent, useState } from "react";
import { Field, Textarea } from "@/components/ui";
import { ERROR_NOTICES } from "@/lib/notices";

/** The longest body the notebook keeps (`NOTEBOOK_BODY_LIMIT` in the notebook service, which refuses a longer one). */
const BODY_LIMIT = 50_000;
const TOO_LONG = ERROR_NOTICES["entry-longer-than-limit"];

/**
 * A notebook entry's body. An over-long body is refused where it was typed and kept as it is: the
 * sentence shows under the box and the form is not sent until the body is shortened.
 */
export function NoteBodyField({
  id,
  label,
  rows,
  defaultValue,
  required,
}: {
  id: string;
  label: string;
  rows: number;
  defaultValue?: string;
  required?: boolean;
}) {
  const [tooLong, setTooLong] = useState(false);
  const check = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const over = event.currentTarget.value.length > BODY_LIMIT;
    event.currentTarget.setCustomValidity(over ? TOO_LONG : "");
    setTooLong(over);
  };
  return (
    <Field label={label} htmlFor={id} hint="Up to 50,000 characters." error={tooLong ? TOO_LONG : null}>
      <Textarea
        id={id}
        name="body"
        rows={rows}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={tooLong || undefined}
        onChange={check}
      />
    </Field>
  );
}
