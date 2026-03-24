# /deploy-staging

Deploy the current branch to the staging environment.

## Steps

1. Verify the build passes: `npm run build`
2. Push the current branch to origin if not already pushed
3. Trigger staging deployment:
   - If Vercel: run `npx vercel --prebuilt --env NEXT_PUBLIC_ENV=staging`
   - If custom: run `npm run deploy:staging` if the script exists
4. Output the staging URL in the PR body under a "## Staging" section

## Notes
- Never deploy to production from this skill
- If deployment fails, comment on the PR with the error log
