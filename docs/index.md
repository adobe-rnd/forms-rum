# Forms RUM Dashboard - User Guide

Welcome to the **Forms RUM (Real User Monitoring) Dashboard**. This guide will help you understand and interpret all the data presented in the dashboard, enabling you to monitor your form's health and performance effectively.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Navigation](#navigation)
3. [Error Analysis Dashboard](#error-analysis-dashboard)
   - [Summary Statistics Panel](#error-summary-statistics-panel)
   - [Error Rate Per Hour Chart](#error-rate-per-hour-chart)
   - [Error Details Panel](#error-details-panel)
   - [User Agent Distribution Chart](#user-agent-distribution-chart)
   - [Missing Resources Panel](#missing-resources-panel)
4. [Performance Dashboard](#performance-dashboard)
   - [Summary Statistics Panel](#performance-summary-statistics-panel)
   - [Engagement Readiness Time Chart](#engagement-readiness-time-chart)
   - [Engagement Readiness Time Distribution](#engagement-readiness-time-distribution)
   - [Resource Loading Times Table](#resource-loading-times-table)
5. [Engagement Dashboard](#engagement-dashboard)
   - [Summary Statistics Panel](#engagement-summary-statistics-panel)
   - [Fill Events Per Hour Chart](#fill-events-per-hour-chart)
   - [Click Events Per Hour Chart](#click-events-per-hour-chart)
6. [Resource Dashboard](#resource-dashboard)
   - [Summary Statistics Panel](#resource-summary-statistics-panel)
   - [Missing Resources List](#missing-resources-list)
7. [Glossary](#glossary)

---

## Getting Started

### What is this Dashboard?

This dashboard provides real-time insights into how your web forms are performing for actual users visiting your website. It collects anonymous data about:

- **Errors**: Resources that failed to load (images, scripts, stylesheets)
- **Performance**: How quickly your form becomes visible and usable to visitors
- **Engagement**: How users interact with your forms (fills and clicks)
- **Resources**: Detailed tracking of missing or failed resources

### Using the Dashboard

1. **Select Date Range**: Use the date picker at the top to choose the time period you want to analyze
2. **Enter URL**: Type or select the specific form page URL you want to monitor
3. **Switch Tabs**: Use the tabs to view different aspects of your form's health

---

## Navigation

The dashboard provides multiple views accessible via tabs:

| Tab | Purpose |
|-----|---------|
| **Error Analysis** | Monitor failed resource loads and missing files that could break your form |
| **Performance** | Track how quickly your form appears and becomes usable for visitors |
| **Engagement** | Analyze how users interact with your form fields |
| **Resources** | Detailed view of all missing resources |

---

## Error Analysis Dashboard

The Error Analysis dashboard helps you identify and fix issues where resources (like images, scripts, or stylesheets) fail to load for your users.

---

### Error Summary Statistics Panel

At the top of the Error Analysis dashboard, you'll find five key metric cards providing an overview of error status.

#### Panel Components

| Metric Card | What It Shows | How to Interpret |
|-------------|---------------|------------------|
| **Total Errors** | The cumulative count of all resource loading failures during the selected period | A higher number indicates more frequent problems. This should ideally be zero or very low. |
| **Total Page Views** | The number of times users loaded your form page | Provides context for other metrics. More views give you more reliable data. |
| **Average Error Rate** | The percentage calculated as: (Total Errors ÷ Total Page Views) × 100 | **Under 1%** = Good | **1-5%** = Needs attention | **Over 5%** = Critical |
| **Page Views with Missing Resources** | Count of page loads where at least one resource failed | Shows real user impact. The subtext shows what percentage of all views were affected. |
| **Unique Missing Resources** | The number of distinct files/URLs that failed to load | A high number means many different things are broken; a low number with high errors means one resource is failing repeatedly. |

#### Visual Indicators

- Values displayed in **red** indicate concerning metrics requiring attention
- The percentage beneath "Page Views with Missing Resources" shows impact scope

#### Example Reading

> **Scenario**: Total Page Views = 10,000 | Page Views with Missing Resources = 500 (5.0%)
> 
> **Interpretation**: 5% of your visitors experienced at least one missing resource. This means 1 in 20 users may have had a degraded experience.

---

### Error Rate Per Hour Chart

This interactive line chart visualizes how error rates fluctuate over time, broken down by hour.

#### Chart Anatomy

| Element | Description |
|---------|-------------|
| **X-Axis (Horizontal)** | Time progression, with each point representing one hour |
| **Y-Axis (Vertical)** | Error rate expressed as a percentage (0% to maximum observed) |
| **Line & Points** | Connect hourly data points; each point is clickable for drill-down |
| **Shaded Area** | Filled area beneath the line showing error rate magnitude |

#### Point Color Coding

Points are color-coded based on error rate severity:

| Point Color | Error Rate | Severity Level |
|-------------|------------|----------------|
| 🟢 **Green** | 0% | Excellent - No errors detected |
| 🟡 **Yellow** | Less than 1% | Minor - Acceptable range |
| 🟠 **Orange** | 1% to 5% | Moderate - Investigate the cause |
| 🔴 **Red** | Above 5% | Critical - Immediate attention needed |

#### Background Shading (Day/Night Indicator)

The chart background indicates time of day:

| Shading | Time Period | Typical Pattern |
|---------|-------------|-----------------|
| **Light/White** | Daytime (6 AM - 8 PM) | Usually higher traffic |
| **Gray/Darker** | Nighttime (8 PM - 6 AM) | Usually lower traffic |

#### Timezone Display

A note below the chart shows your local timezone (e.g., "UTC+05:30") so you can correctly interpret the hour labels.

#### Interactivity

- **Hover** over any point to see a tooltip with:
  - Error Rate percentage
  - Total Errors count
  - Total Page Views for that hour
- **Click** any point to open the [Error Details Panel](#error-details-panel)

#### What to Look For

| Pattern | Possible Cause | Recommended Action |
|---------|----------------|-------------------|
| Sudden spike at a specific hour | Deployment, server issue, or third-party outage | Check deployment logs for that time |
| Daily recurring spikes at same hour | Scheduled jobs, cache expiration, or maintenance | Review automated processes |
| Gradual increase over days | Growing infrastructure problem | Investigate server capacity and CDN health |
| Higher rates during peak hours | Server overload | Consider scaling resources |

---

### Error Details Panel

When you click on a point in the Error Rate chart, a detailed breakdown panel slides into view.

#### How to Access

1. Click any point on the Error Rate Per Hour chart
2. The panel appears below the chart with the header "Error Details for [Selected Hour]"

#### Panel Contents

##### Error Sources List

A scrollable list showing every unique error that occurred during the selected hour.

| Column | Description |
|--------|-------------|
| **Error Description** | The source/target information identifying what failed (typically a URL or resource path) |
| **Count** | How many times this specific error occurred during the hour |
| **Percentage** | This error's share of total errors for the hour |

##### Reading the List

- Errors are sorted by frequency (most common at top)
- Higher percentages indicate the dominant issues to fix first
- The URL shown helps identify exactly which file failed

#### Returning to Overview

Click the **"← Back to Overview"** button in the panel header to collapse the details and return to the main view.

---

### User Agent Distribution Chart

This pie chart appears within the Error Details Panel and shows which browsers, devices, and operating systems experienced errors.

#### What It Shows

A colorful pie chart breaking down errors by **User Agent** — the combination of browser type, version, device type, and operating system used by visitors.

#### Chart Components

| Element | Description |
|---------|-------------|
| **Pie Segments** | Each colored segment represents a different user agent configuration |
| **Legend (Right side)** | Lists each user agent with its percentage of total errors |
| **Hover Tooltip** | Shows exact count and percentage for each segment |

#### Color Palette

The chart uses 12 distinct colors cycling through:
- Blue, Green, Amber, Red, Violet, Pink, Teal, Orange, Indigo, Lime, Cyan, Rose

#### How to Interpret

| Observation | What It Means | Action |
|-------------|---------------|--------|
| One segment dominates (>50%) | Errors are concentrated in specific browser/device | Investigate compatibility issues for that platform |
| Even distribution | Errors affect all users equally | Likely a server-side or universal resource issue |
| Mobile browsers dominate | Mobile-specific problem | Check responsive design and mobile resource loading |
| Older browser versions dominate | Legacy browser compatibility | Consider polyfills or graceful degradation |

#### Example Interpretation

> **Scenario**: Chrome/Android = 45%, Safari/iOS = 35%, Firefox = 15%, Others = 5%
> 
> **Interpretation**: Mobile browsers (Chrome Android + Safari iOS = 80%) are experiencing most errors. This suggests a mobile-specific issue, possibly with resource paths or mobile-optimized assets.

---

### Missing Resources Panel

Located at the bottom of the Error Analysis dashboard, this panel provides a comprehensive list of all resources (files) that failed to load.

#### Panel Header

Shows the title "Missing Resources (sorted by frequency)" indicating that the most problematic resources appear first.

#### Filter Bar

Filter the list by resource type using checkboxes:

| Filter | File Types Included | When to Use |
|--------|---------------------|-------------|
| **Image** | PNG, JPG, JPEG, GIF, WebP, SVG, BMP, ICO, TIFF, AVIF | Finding broken images |
| **JavaScript** | JS, MJS, CJS | Finding script failures (critical for form function) |
| **CSS** | CSS | Finding stylesheet issues (affects appearance) |
| **JSON** | JSON | Finding data/configuration file issues |
| **Others** | All other file types | Fonts, videos, documents, etc. |

Each filter shows a count in parentheses: e.g., "Image (23)" means 23 image resources are missing.

A counter on the right shows: "X out of Y visible" indicating how many resources match your current filters.

#### Severity Legend

Below the filters, a legend explains the color-coded severity:

| Badge | Threshold | Meaning |
|-------|-----------|---------|
| 🔴 **High** | ≥ 40% of max frequency | Critical - Affects many page views |
| 🟡 **Medium** | ≥ 10% and < 40% of max | Important - Significant impact |
| ⚪ **Low** | < 10% of max | Minor - Limited impact |

#### Resource List Columns

| Column | What It Shows |
|--------|---------------|
| **Resource URL** | Full file path that failed to load (monospace font for readability) |
| **Rank** | Position in the sorted list (#1 is most frequent) |
| **Count** | Number of page views affected by this missing resource |
| **Percentage** | Portion of total page views affected (e.g., "2.5%") |

#### Row Highlighting

| Background Color | Meaning |
|------------------|---------|
| 🔴 **Light Red** | High frequency - Priority fix |
| 🟡 **Light Yellow** | Medium frequency - Should fix |
| **White** | Low frequency - Can defer |

#### Success State

When no resources are missing, you'll see:
> ✓ No missing resources detected! All resources loaded successfully.

This appears with a green background, indicating healthy status.

#### Prioritization Strategy

1. **Fix High (red) items first** - They impact the most users
2. **Prioritize JavaScript/CSS over Images** - Scripts affect functionality; images affect only appearance
3. **Check domain ownership** - Your domain vs. third-party (you may not control third-party resources)
4. **Look for patterns** - Multiple files from same path might indicate a folder/deployment issue

---

## Performance Dashboard

The Performance Dashboard helps you understand how quickly your form becomes visible and interactive for visitors.

---

### What is "Engagement Readiness Time"?

**Engagement Readiness Time** (also called Form Visibility Time) measures the duration from when a user starts loading your page until your form block becomes visible on screen and ready for interaction.

> **Think of it as**: "How long do users wait before they can start filling out the form?"

---

### Performance Summary Statistics Panel

Three key metric cards showing overall form load performance.

#### Panel Components

| Metric Card | What It Shows | How to Interpret |
|-------------|---------------|------------------|
| **Fastest (Min)** | The shortest load time recorded from any user | Best-case scenario; shows what's possible with fast connection/device |
| **p50 (Median)** | The middle value - 50% of users loaded faster, 50% slower | **Your "typical" user experience** - most important metric |
| **p75** | 75% of users loaded faster than this time | Shows experience for slower users - important for inclusivity |

#### Clickable Cards

The **p50** and **p75** cards are interactive:
- Click **p50** to view median values in the chart below
- Click **p75** to view 75th percentile values in the chart below
- The active selection shows with a **blue highlight**

#### Color Coding for Times

| Color | Time | Performance Rating |
|-------|------|---------------------|
| 🟢 **Green** | Under 1 second | Fast - Excellent |
| 🟡 **Yellow/Amber** | 1 to 2 seconds | Moderate - Acceptable |
| 🔴 **Red** | Over 2 seconds | Slow - Needs improvement |

#### Understanding p50 vs p75

| Percentile | Meaning | Why It Matters |
|------------|---------|----------------|
| **p50 (Median)** | Half your users load faster than this | Represents your "average" user; if this is good, most users are satisfied |
| **p75** | Three-quarters of users load faster | Represents your slower users; ensures you're not leaving anyone behind |

---

### Engagement Readiness Time Chart

An interactive line chart showing how form visibility times change throughout the day.

#### Chart Anatomy

| Element | Description |
|---------|-------------|
| **X-Axis (Horizontal)** | Time broken down by hour |
| **Y-Axis (Vertical)** | Load time in seconds (or milliseconds for fast loads) |
| **Line** | Shows either p50 or p75 values based on your selection above |
| **Shaded Area** | Filled area beneath the line |

#### Point Color Coding

Each point is colored based on performance:

| Point Color | Load Time | Performance Level |
|-------------|-----------|-------------------|
| 🟢 **Green** | ≤ 1 second | Fast |
| 🟡 **Yellow** | 1-2 seconds | Moderate |
| 🟠 **Orange** | 2-3 seconds | Slow |
| 🔴 **Red** | > 3 seconds | Very Slow |

#### Background Shading

| Shading | Time Period |
|---------|-------------|
| **Light/White** | Daytime hours (6 AM - 8 PM) |
| **Gray/Darker** | Nighttime hours (8 PM - 6 AM) |

#### Tooltip Information

Hover over any point to see:
- Selected percentile value (p50 or p75)
- Page Views count for that hour
- Minimum load time for that hour

#### Switching Between p50 and p75

- Click the **p50** stat card above to view median times
- Click the **p75** stat card above to view 75th percentile times
- The chart title updates to reflect your selection

#### Patterns to Watch For

| Pattern | Possible Cause | Action |
|---------|----------------|--------|
| Consistently high during business hours | Server overload from traffic | Scale resources or optimize caching |
| Spikes at specific times | Competing processes or deployments | Review server activity logs |
| Gradual increase over days | Growing payload or degrading infrastructure | Audit page weight and server health |
| Night times much faster than day | Traffic-dependent performance | Consider CDN or server upgrades |

---

### Engagement Readiness Time Distribution

A bar chart (histogram) showing the distribution of load times across all page views.

#### Chart Title

"Engagement Readiness Time (Form Visibility) Distribution"

#### How It Works

The chart divides all recorded load times into time ranges (buckets) and shows how many page views fell into each range.

#### Default Time Buckets

| Bucket | Represents |
|--------|------------|
| **0 - 10s** | Very fast to fast loads |
| **10 - 20s** | Moderate loads |
| **20 - 60s** | Slower loads |
| **60s+** | Very slow loads |

#### Reading the Chart

| Bar Position | Interpretation |
|--------------|----------------|
| **Most bars on left side** | Good! Most users experience fast loads |
| **Bars evenly distributed** | Mixed performance - some users fast, some slow |
| **Most bars on right side** | Concerning - many users experiencing slow loads |
| **Tall single bar** | Most users have similar experience (could be good or bad depending on position) |

#### Tooltip Information

Hover over any bar to see:
- Count of page views in that range
- Percentage of total views
- Exact time range

#### Statistics Panel (Below Chart)

| Statistic | What It Shows |
|-----------|---------------|
| **Total Views** | Number of page loads measured |
| **Min View Time** | Fastest recorded load |
| **Max View Time** | Slowest recorded load |
| **Mean (Average)** | Arithmetic average of all load times |
| **Median** | Middle value (50% faster, 50% slower) |

#### Interpreting Mean vs Median

| Relationship | Interpretation |
|--------------|----------------|
| Mean ≈ Median | Balanced distribution; no extreme outliers |
| Mean > Median | Some very slow loads are pulling average up; focus on outliers |
| Mean < Median | Some very fast loads exist; unusual pattern |

---

### Resource Loading Times Table

A detailed, sortable table showing how long individual resources take to load.

#### Summary Bar

At the top of the table:

| Metric | What It Shows |
|--------|---------------|
| **Total Resources** | Count of unique resource files tracked |
| **Avg Load Time** | Mean loading time across all resources |
| **Slowest Resource (p95)** | 95th percentile of slowest resource - worst-case scenario |

#### Performance Legend

| Badge Color | Time Range | Classification |
|-------------|------------|----------------|
| 🟢 **Green (Fast)** | < 250ms | Excellent |
| 🟡 **Yellow (Moderate)** | 250ms - 1s | Acceptable |
| 🔴 **Red (Slow)** | ≥ 1s | Needs optimization |

#### Table Columns

| Column | Description | Click to Sort |
|--------|-------------|---------------|
| **Resource URL** | File path/address | Alphabetically |
| **Min** | Fastest recorded load for this resource | Fastest first/last |
| **Median (p50)** | Typical load time (50% faster than this) | By typical speed |
| **p75** | 75% of loads are faster | By slower experience |
| **p95** | 95% of loads are faster (near worst-case) | By worst-case |
| **Mean** | Average load time | By average speed |
| **Count** | How many times resource was loaded | By frequency |

#### Row Highlighting

Entire rows are highlighted based on **mean** loading time:

| Row Color | Meaning |
|-----------|---------|
| 🟢 **Light Green** | Fast loading resource |
| 🟡 **Light Yellow** | Moderate loading resource |
| 🔴 **Light Red** | Slow loading resource |

#### Search Feature

Use the search box to filter resources by URL. Useful for:
- Finding specific file types (e.g., search ".js")
- Finding resources from specific domains
- Locating a known problematic file

#### Sorting

Click any column header to sort:
- First click: Descending order (highest/slowest first)
- Second click: Ascending order (lowest/fastest first)
- Arrow indicator shows current sort direction

#### Optimization Priority

Focus on resources with:
1. **High count + slow time** = Most user impact
2. **JavaScript/CSS** = Critical for functionality
3. **Slow p95 but fast median** = Occasional issues worth investigating

---

## Engagement Dashboard

The Engagement Dashboard tracks how users interact with your form, measuring fill events (typing in fields) and click events.

---

### Engagement Summary Statistics Panel

Five metric cards showing user interaction overview.

#### Panel Components

| Metric Card | What It Shows | Visual Style |
|-------------|---------------|--------------|
| **Total Page Views** | Total visits to the form page | Blue accent |
| **Views with Fills** | Page views where users typed in at least one field | Green accent |
| **Views with Clicks** | Page views where users clicked on form elements | Purple accent |
| **Average Fills per Page** | Mean number of fill events per page view | Green accent |
| **Average Clicks per Page** | Mean number of click events per page view | Purple accent |

#### Engagement Rates

Beneath "Views with Fills" and "Views with Clicks", you'll see engagement rates:
- **Fill Rate**: (Views with Fills ÷ Total Views) × 100%
- **Click Rate**: (Views with Clicks ÷ Total Views) × 100%

#### Interpreting Engagement

| Rate | Interpretation |
|------|----------------|
| **High Fill Rate (>50%)** | Users are actively engaging with your form |
| **Low Fill Rate (<20%)** | Users may be bouncing before interacting |
| **High Clicks, Low Fills** | Users clicking but not typing - possible UX confusion |
| **Higher Fills than Clicks** | Normal for forms with many fields |

---

### Fill Events Per Hour Chart

A line chart tracking form field fill events over time.

#### What It Measures

A "fill event" occurs when a user types into a form field (input, textarea, etc.).

#### Chart Elements

| Element | Description |
|---------|-------------|
| **X-Axis** | Hours of the selected date range |
| **Y-Axis** | Number of fill events |
| **Line Color** | Green (matching fill metric styling) |
| **Shaded Area** | Green fill beneath the line |

#### Point Colors

| Color | Fill Count | Meaning |
|-------|------------|---------|
| ⚪ **Gray** | 0 | No fill events |
| 🟡 **Yellow** | < 10 | Low engagement |
| 🟢 **Green** | 10-50 | Good engagement |
| 🟢 **Dark Green** | > 50 | High engagement |

#### Tooltip Information

Hover to see:
- Fill Events count
- Page Views for that hour
- Views with Fills (unique sessions with at least one fill)

---

### Click Events Per Hour Chart

A line chart tracking form click events over time.

#### What It Measures

A "click event" occurs when a user clicks on form elements (buttons, fields, dropdowns, etc.).

#### Chart Elements

| Element | Description |
|---------|-------------|
| **X-Axis** | Hours of the selected date range |
| **Y-Axis** | Number of click events |
| **Line Color** | Purple (matching click metric styling) |
| **Shaded Area** | Purple fill beneath the line |

#### Point Colors

| Color | Click Count | Meaning |
|-------|-------------|---------|
| ⚪ **Gray** | 0 | No click events |
| 💜 **Light Purple** | < 20 | Low engagement |
| 💜 **Purple** | 20-100 | Good engagement |
| 💜 **Dark Purple** | > 100 | High engagement |

#### Tooltip Information

Hover to see:
- Click Events count
- Page Views for that hour
- Views with Clicks (unique sessions with at least one click)

---

## Resource Dashboard

A focused view on missing resources, providing the same information as the Missing Resources panel in Error Analysis but as a standalone dashboard.

---

### Resource Summary Statistics Panel

Three key metrics about missing resources.

| Metric Card | What It Shows |
|-------------|---------------|
| **Total Page Views** | Overall page visits for context |
| **Page Views with Missing Resources** | How many visits experienced at least one missing resource |
| **Unique Resources** | Count of distinct resource URLs that failed |

---

### Missing Resources List

A scrollable list of all missing resources, sorted by frequency (most impactful first).

#### List Item Components

| Element | Description |
|---------|-------------|
| **Resource URL** | Full path of the missing file |
| **Rank** | Position in frequency ranking (#1 = most frequent) |
| **Count** | Number of page views affected |
| **Percentage** | Portion of total page views affected |

#### Severity Highlighting

| Background | Threshold | Priority |
|------------|-----------|----------|
| 🔴 **Red** | ≥ 50% of max count | Critical |
| 🟡 **Yellow** | ≥ 20% of max count | Important |
| **White** | < 20% of max count | Low priority |

---

## Glossary

| Term | Definition |
|------|------------|
| **Page View** | A single instance of a user loading your form page |
| **Error Rate** | Percentage of page views that experienced one or more resource loading errors |
| **Resource** | Any file loaded by your webpage: images, scripts, stylesheets, fonts, data files, etc. |
| **Missing Resource** | A file that failed to load for a user (404 error, timeout, blocked, etc.) |
| **p50 (Median)** | The middle value when all measurements are sorted - 50% are faster, 50% are slower |
| **p75 (75th Percentile)** | 75% of measurements are faster than this value |
| **p95 (95th Percentile)** | 95% of measurements are faster; shows near-worst-case scenario |
| **Mean (Average)** | Sum of all values divided by the count of values |
| **User Agent** | Browser and device information (e.g., "Chrome 120 on Windows 11") |
| **Engagement Readiness Time** | Time until your form is visible and ready for user interaction |
| **Fill Event** | User typing/entering data into a form field |
| **Click Event** | User clicking on any form element |
| **RUM (Real User Monitoring)** | Collecting performance data from actual user visits, not simulated tests |
| **CDN (Content Delivery Network)** | Network of servers that deliver content to users from nearby locations |
| **Facet** | A dimension used to group and analyze data (e.g., by hour, by resource, by user agent) |

---


## Support

If you have questions about the dashboard or need assistance interpreting your data, please contact your account representative or support team.

---

*Dashboard Version: 1.0 | Last Updated: December 2024*

