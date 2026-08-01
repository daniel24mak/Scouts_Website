# Form Question Display Design

## Goal

Allow form creators to show or hide question numbers across an entire form, and make questions using the existing `No box` surface look intentional and professional.

## Behavior

- Add `appearance.showQuestionNumbers` to form settings.
- Existing forms and missing settings default to `true`.
- The toggle appears in the form builder's Appearance section.
- The setting applies to form previews, authenticated dashboard forms, public forms, registration forms, and answer-review views that use the shared form renderer.
- Builder-only question labels remain numbered because they are editing controls, not respondent-facing form content.

## Rendering

- When question numbers are enabled, preserve the current numbered heading.
- When disabled, do not render the number element and add a class to the form canvas so the title occupies the first heading column without an empty gap.
- Required markers, descriptions, helper text, validation, conditional visibility, layout widths, and answer controls are unchanged.

## Unboxed Questions

- Keep a transparent background and no surrounding card border.
- Use clear vertical rhythm between the heading, guidance, and input.
- Separate consecutive unboxed questions with a subtle divider and consistent spacing.
- Use a restrained focus accent on the divider instead of adding a card background or shadow.
- Stack safely on mobile and use the existing dashboard/form color tokens in light and dark modes.

## Testing

- Verify missing settings normalize to `showQuestionNumbers: true`.
- Verify explicit `false` remains false through normalization.
- Verify focused form model tests and the production Vite build.

