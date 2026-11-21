# Deploy: landing page builder (stage 1, pages)

The first part of the page, funnel and website builder. It uses the same full-screen editor style as Form Studio.

## What's in it

1. **Sites, then Funnels and pages** in the sidebar is now live (it said "soon" before).
2. **New page** gives three ways to start:
   - **Templates**: 10 ready pages (book a call, lead magnet, aesthetics clinic, dental, trades, property, webinar, sales page, thank you, coming soon). Each has a live preview on desktop and mobile.
   - **Build with AI**: describe the business and offer, pick a form, and it drafts the whole page.
   - **Start from scratch**.
3. **Page Studio** (full screen, no sidebar):
   - Drag in 16 ready sections (header, hero, hero with picture, hero with form, logos, features, benefits, stats, video, testimonials, pricing, FAQ, countdown, form, call to action, footer) or 19 single blocks.
   - Rows of 1 to 4 columns. On phones the columns stack.
   - Click anything to edit it on the right: text, colours, backgrounds, spacing, alignment, buttons and links (to a section, a URL, a phone number or an email).
   - Picture upload (up to 5MB), YouTube, Vimeo and Loom videos, your Scalency forms, countdown timers, and custom code (kept in a safe box so it can't touch the rest of the page).
   - Hide a section on mobile or on desktop.
   - Desktop and mobile view, preview, undo and redo, keyboard shortcuts, autosave with the "Saved" pop-up.
   - Page settings: fonts and colours, SEO title, description and share picture, Facebook Pixel and Google tracking IDs, and the page link.
4. **Publish** makes the page live at `os.scalency.us/p/<workspace>/<page>`. Views are counted per day and shown in the list.
5. Duplicate, archive and delete pages from the list.

Funnels (several steps in order) and websites with their own domain are the next two stages.

## Part 1. Code (Command Prompt)

```
cd %USERPROFILE%\Desktop\scalency-os
git checkout main
git pull
git checkout -b pages-builder
tar -xf %USERPROFILE%\Downloads\pages-builder.zip
git add -A
git commit -m "Page builder stage 1: Page Studio, templates, AI pages, public pages"
git push -u origin pages-builder
```

On GitHub click **Compare & pull request**, then **Create pull request**. Don't merge yet.

## Part 2. Database (Supabase, SQL Editor)

1. Supabase, the scalency-os project, **SQL Editor**, **New query**.
2. Open the **SQL-8** text file, copy everything, paste it in and click **Run**. It should say "Success".

This adds the sites, pages and page views tables, and the `page-media` picture storage.

To check the storage: **Storage** on the left should now show a bucket called `page-media`. If it isn't there, tell me.

## Part 3. The AI page function (Supabase, Edge Functions)

This is a new function, next to `ai-form`. It uses the same `ANTHROPIC_API_KEY` secret, so there's nothing new to add.

1. Supabase, **Edge Functions** on the left.
2. Click **Deploy a new function**, then **Via Editor**.
3. Delete the sample code in the editor.
4. Open the **ai-page-code** text file, copy everything and paste it in.
5. At the bottom, change the function name to exactly `ai-page`.
6. Click **Deploy function**. Wait until it says it's deployed.

## Part 4. Merge

Merge the pull request on GitHub. Netlify takes about 3 minutes.

## Part 5. Test (5 minutes)

1. Open os.scalency.us and sign in.
2. Sidebar: **Sites**, then **Funnels and pages**, then **New page**.
3. Pick the **Book a call** template, click **Use this template**. Page Studio opens full screen.
4. Click the main heading and change the words. You should see "Saved" at the top.
5. Drag a **Testimonials** section from the left onto the page. Press Ctrl+Z to undo it, then Ctrl+Y to bring it back.
6. Click the phone icon at the top (Phone view) to see the mobile layout.
7. Click **Publish**, then open the page link. Try it on your phone too.
8. Back in the list, the page should show its views.
9. Try **New page**, then the **Build with AI** tab, with a short description of a business.

If anything shows an error, send me a screenshot.
