import { NextRequest, NextResponse } from "next/server";

const NEWSAPI_KEY = process.env.NEWSAPI_KEY || "";
const NEWSAPI_URL = "https://newsapi.org/v2";

// Keywords related to prediction markets
const MARKET_KEYWORDS = [
  "election",
  "president",
  "CPI",
  "inflation",
  "Fed",
  "Federal Reserve",
  "interest rate",
  "GDP",
  "unemployment",
  "Super Bowl",
  "NFL",
  "crypto",
  "bitcoin",
  "ethereum",
  "stock market",
  "S&P 500",
  "NASDAQ",
];

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") || "10");
  const category = req.nextUrl.searchParams.get("category") || "business";

  try {
    let articles: any[] = [];

    if (NEWSAPI_KEY && NEWSAPI_KEY !== "") {
      // Use NewsAPI if key is configured
      try {
        const query = MARKET_KEYWORDS.slice(0, 3).join(" OR ");
        const response = await fetch(
          `${NEWSAPI_URL}/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=${limit}&apiKey=${NEWSAPI_KEY}`,
          { next: { revalidate: 300 } } // Cache for 5 minutes
        );

        if (response.ok) {
          const data = await response.json();
          articles = (data.articles || []).map((article: any) => ({
            title: article.title,
            description: article.description,
            url: article.url,
            source: article.source?.name || "Unknown",
            publishedAt: article.publishedAt,
            imageUrl: article.urlToImage,
          }));
        }
      } catch (error) {
        console.error("NewsAPI error:", error);
      }
    }

    // Fallback to mock data if NewsAPI fails or not configured
    if (articles.length === 0) {
      articles = [
        {
          title: "Fed Signals Potential Rate Cuts Ahead",
          description: "Federal Reserve officials hint at possible interest rate adjustments in upcoming meetings.",
          url: "#",
          source: "Financial Times",
          publishedAt: new Date().toISOString(),
        },
        {
          title: "CPI Data Shows Inflation Cooling",
          description: "Latest consumer price index data indicates inflation is trending downward.",
          url: "#",
          source: "Bloomberg",
          publishedAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          title: "Election Polls Show Tight Race",
          description: "Latest polling data reveals a competitive presidential race.",
          url: "#",
          source: "Reuters",
          publishedAt: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          title: "Super Bowl MVP Odds Shift",
          description: "Betting markets adjust MVP predictions ahead of championship game.",
          url: "#",
          source: "ESPN",
          publishedAt: new Date(Date.now() - 10800000).toISOString(),
        },
      ];
    }

    return NextResponse.json({
      articles: articles.slice(0, limit),
      source: NEWSAPI_KEY ? "NewsAPI" : "Mock Data",
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 },
    );
  }
}

