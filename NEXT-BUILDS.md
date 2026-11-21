# Scalency OS: what's done, what's agreed, what's next (21 Nov 2026)

## Done and deployed
- Forms: Form Studio, templates, Build with AI, workspace links, embeds (inline, popup, slide-in), duplicate, uploads and signatures, views and conversion, alerts.
- Access-based menus: team members only see what they've been given.
- Workflow builder with If / else branches, draggable side panel, triggers with search.
- Editable dashboard, session time-outs.

## In this release (21 Nov)
- Full-screen builders, "Saved" pop-ups.
- Insert field rebuilt, more message fields.
- 26 If / else conditions with a searchable picker; real teammate names.
- Email sending from the client's own mailbox (option 1) and own domain (option 3), as agreed with Tolu.
- Sign-in code by email after a password sign-in.
- Next.js security update.

## Agreed with Tolu, still to do
- **Option 2: one-click Gmail and Outlook.** Google has to approve the app first (a review that can take a few weeks), so the application should start early. About 3 days to build once approved.
- **Replies from clients' own mailboxes into the Scalency inbox** (reading the mailbox, IMAP). About 2 days.
- **Per-customer phone numbers and calling**: on hold until Tolu decides.

## Next build: pages, funnels and websites (about 12 days)
This uses the same editor as Form Studio (sections of one to four columns, drag and drop, styles, undo, autosave, full screen), with more blocks.

1. **Page builder: 5 days**
   - Blocks: header and menu, hero, text, image, video, button, forms (from Form Studio), testimonials, pricing, FAQ, countdown, logos, icons and features, divider, spacer, custom code, footer.
   - Templates for the niches Tolu targets (aesthetics, dental, construction, property, coaching), plus Build with AI.
   - Page settings: title, description, social image, favicon, Facebook Pixel and Google tag, custom code in the head.
   - Desktop and mobile views, publish and unpublish, the same link style as forms.
2. **Funnels: 4 days**
   - Steps in order (opt-in, sales, booking, thank you), with each step's form or button leading to the next.
   - Views and conversion for each step, and split testing two versions of a step.
   - Workflow trigger: "Funnel step visited" or "Funnel completed".
3. **Websites: 3 days**
   - Several pages with a shared header, menu and footer, and a blog later.
   - The client's own domain: they add a record at their DNS provider and we connect it in Netlify. Free on Netlify's current plan, but with a limit per site to check before launch.

## Smaller items queued
- Form folders, and a visible "I'm not a robot" check on forms: 1 day.
- AI opportunity audit (website scan and report): needs a Google Maps key from Tolu.
- Calendar and booking pages (Tolu's Notion: 1 to 5 Feb).
