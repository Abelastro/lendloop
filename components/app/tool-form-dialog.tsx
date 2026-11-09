"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { PencilSimple, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  CATEGORIES,
  CONDITIONS,
  CONDITION_LABELS,
  MAX_TOOL_DESCRIPTION,
  MAX_TOOL_NAME,
} from "@/convex/lib/constants";
import { getErrorMessage } from "@/lib/errors";
import {
  hasErrors,
  validateToolDraft,
  type ToolDraftErrors,
} from "@/lib/form-validation";
import type { MyTool } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  FieldHint,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

type EditableTool = Pick<MyTool, "name" | "category" | "condition" | "description"> & {
  _id: MyTool["_id"];
};

export function ToolFormDialog({
  tool,
  label,
  variant = tool ? "ghost" : "primary",
  size = tool ? "sm" : "md",
}: {
  tool?: EditableTool;
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}) {
  const createTool = useMutation(api.tools.create);
  const updateTool = useMutation(api.tools.update);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(tool?.name ?? "");
  const [description, setDescription] = useState(tool?.description ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ToolDraftErrors>({});

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(tool?.name ?? "");
      setDescription(tool?.description ?? "");
      setFormError(null);
      setFieldErrors({});
    } else {
      setFormError(null);
      setFieldErrors({});
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const errors = validateToolDraft({
      name: trimmedName,
      description: trimmedDescription,
    });
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setPending(true);
    try {
      const payload = {
        name: trimmedName,
        category: String(data.get("category") ?? ""),
        condition: String(data.get("condition") ?? ""),
        description: trimmedDescription,
      };
      if (tool) {
        await updateTool({ toolId: tool._id, ...payload });
        toast.success("Listing updated.");
      } else {
        await createTool(payload);
        toast.success("Listing added to the board.");
      }
      setOpen(false);
    } catch (cause) {
      setFormError(getErrorMessage(cause, "We could not save this listing."));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => handleOpenChange(true)}
        aria-haspopup="dialog"
      >
        {tool ? (
          <PencilSimple size={15} aria-hidden />
        ) : (
          <Plus size={16} weight="bold" aria-hidden />
        )}
        {label ?? (tool ? "Edit" : "List a tool")}
      </Button>
      <Modal
        open={open}
        onOpenChange={handleOpenChange}
        title={tool ? "Edit listing" : "List a tool"}
        description={
          tool
            ? "Keep the details accurate so the right neighbor can find it."
            : "Add something useful that sits idle. You can edit or remove it later."
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="tool-name" hint={`${name.length}/${MAX_TOOL_NAME}`}>
              Tool name
            </Label>
            <Input
              id="tool-name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_TOOL_NAME}
              placeholder="Cordless drill with bits"
              required
              autoFocus
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "tool-name-error" : "tool-name-hint"}
            />
            {fieldErrors.name ? (
              <FieldError id="tool-name-error">{fieldErrors.name}</FieldError>
            ) : (
              <FieldHint id="tool-name-hint">3–{MAX_TOOL_NAME} characters.</FieldHint>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tool-category">Category</Label>
              <Select
                id="tool-category"
                name="category"
                defaultValue={tool?.category ?? CATEGORIES[0]}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tool-condition">Condition</Label>
              <Select
                id="tool-condition"
                name="condition"
                defaultValue={tool?.condition ?? "good"}
              >
                {CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {CONDITION_LABELS[condition]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="tool-description"
              hint={`${description.length}/${MAX_TOOL_DESCRIPTION}`}
            >
              Short description
            </Label>
            <Textarea
              id="tool-description"
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={MAX_TOOL_DESCRIPTION}
              placeholder="Includes two batteries and a full bit set. Please return the case."
              required
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={
                fieldErrors.description
                  ? "tool-description-error"
                  : "tool-description-hint"
              }
            />
            {fieldErrors.description ? (
              <FieldError id="tool-description-error">
                {fieldErrors.description}
              </FieldError>
            ) : (
              <FieldHint id="tool-description-hint">
                10–{MAX_TOOL_DESCRIPTION} characters.
              </FieldHint>
            )}
          </div>

          <FieldError id="tool-form-error">{formError}</FieldError>

          <div className="border-line flex justify-end gap-2 border-t pt-5">
            <Button
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : tool ? "Save changes" : "Add to the board"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
