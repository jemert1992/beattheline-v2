# Sports Analytics Platform - Vercel Deployment Guide

This guide provides step-by-step instructions for deploying the sports analytics platform on Vercel.

## Project Structure for Vercel

The project has been optimized for Vercel deployment with the following structure:

```
sports-analytics-vercel/
├── public/                  # Static assets
├── src/                     # Source code
│   ├── components/          # Reusable UI components
│   ├── context/             # Context providers
│   ├── pages/               # Page components
│   └── utils/               # Utility functions
├── index.html               # HTML entry point
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite configuration
├── vercel.json              # Vercel-specific configuration
└── tsconfig.json            # TypeScript configuration
```

## Deployment Steps

### 1. Set Up GitHub Repository

1. Create a new GitHub repository
2. Upload all files from the `sports-analytics-vercel` directory to your repository
3. Make sure to include all configuration files (including hidden files)

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/login (you can use your GitHub account)
2. Click "Add New" > "Project"
3. Select the GitHub repository you created
4. Vercel will automatically detect the project as a Vite/React application

### 3. Configure Environment Variables

1. In the Vercel project settings, go to the "Environment Variables" tab
2. Add the following variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

### 4. Deploy

1. Click "Deploy"
2. Vercel will build and deploy your application
3. Once complete, you'll receive a URL where your application is live

## Supabase Setup

1. Log in to your Supabase account
2. Create a new project
3. Navigate to the SQL Editor
4. Execute the SQL scripts from the `database/supabase-schema.md` file to create the database schema
5. Copy your Supabase URL and anon key from the API settings page to use in the Vercel environment variables

## Data Updates

For the data update functionality that was previously scheduled as a cron job, you have two options:

1. **Vercel Cron Jobs** (Recommended):
   - Add a `/api/update.js` serverless function
   - Configure it in the Vercel dashboard under "Cron Jobs"
   - Set it to run daily at 6:00 AM UTC

2. **Manual Updates**:
   - Use the "Refresh Data" button in the UI
   - This will trigger the data update process on demand

## Customization

### Modifying Prediction Algorithms

The prediction algorithms are located in the `/src/utils/` directory:

- `nbaAlgorithms.ts`: NBA prediction algorithm
- `nhlAlgorithms.ts`: NHL prediction algorithm
- `mlbAlgorithms.ts`: MLB prediction algorithm

You can modify these files to adjust the prediction models or add new features.

### Updating the Frontend

The frontend is built with React, TypeScript, and Tailwind CSS. The main components are:

- `SportSection.tsx`: Reusable component for displaying sport-specific data
- `BetsOfTheDay.tsx`: Component for displaying the top analytical picks
- `NBAPage.tsx`, `NHLPage.tsx`, `MLBPage.tsx`: Sport-specific pages
- `BetsOfTheDayPage.tsx`: Page for displaying all Bets of the Day

## Advantages of Vercel Deployment

- **Performance**: Global CDN for fast loading worldwide
- **Reliability**: High uptime and automatic scaling
- **CI/CD**: Automatic deployments when you push to GitHub
- **Preview Deployments**: Every pull request gets its own preview URL
- **Serverless Functions**: Easy to add backend functionality
- **Analytics**: Built-in analytics for your application
- **Custom Domains**: Easy to add your own domain name

## Troubleshooting

If you encounter any issues during deployment:

1. Check the Vercel deployment logs for specific error messages
2. Verify that your environment variables are correctly set
3. Ensure your Supabase project is active and accessible
4. Check that the database schema has been properly created

For additional support, refer to:
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.io/docs)
- [React Documentation](https://reactjs.org/docs)
- [Vite Documentation](https://vitejs.dev/guide/)
