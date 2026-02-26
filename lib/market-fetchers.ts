import { generateKalshiHeaders } from './kalshi-auth';

export interface MarketOutcome {
  id: string;
  name: string;
  price: number; 
  tokenId?: string; 
}

export interface UnifiedMarket {
  id: string;
  conditionId: string;
  provider: 'Kalshi' | 'Polymarket';
  name: string;
  eventTitle?: string; // Rich display title (may include subtitle)
  description: string;
  price: number; // Primary/First outcome price
  outcomes: MarketOutcome[]; // EVERY choice indexed here
  imageUrl: string;
  polymarketUrl: string;
  kalshiUrl?: string; // Direct link to Kalshi market page
  slug: string;
  volume: number;
  volumeFormatted: string;
  category: string;
  last_updated: string;
  resolutionDate: string;
  change: number;
}

export async function fetchPolymarketMarkets(limit: number = 10000): Promise<UnifiedMarket[]> {
  try {
    // RECURSIVE PAGINATION: Fetch ALL active events from Polymarket
    // Continue fetching until we get fewer than 1000 items OR reach 5000 item safety limit
    const allRawEvents: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    // Use the limit parameter as safety limit if it's lower than 5000
    // This allows optimized endpoints (like /trending) to stop early
    const safetyLimit = limit < 5000 ? limit : 5000; // Maximum total items to fetch
    let hasMore = true;
    let batchCount = 0;
    
    console.log(`[Polymarket] Starting recursive pagination (safety limit: ${safetyLimit} items)`);
    
    while (hasMore && allRawEvents.length < safetyLimit) {
      // Construct URL with offset parameter
      const url = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=${batchSize}&offset=${offset}`;
      
      console.log(`[Polymarket] Fetching batch ${batchCount + 1} at offset ${offset}...`);
      
      const response = await fetch(url, { 
        method: 'GET', 
        headers: { 'Content-Type': 'application/json' }, 
        cache: 'no-store' 
      });

      if (!response.ok) {
        console.warn(`[Polymarket] API request failed at offset ${offset}:`, response.status);
        break;
      }
      
      const batchEvents = await response.json();
      
      // Debug: Log raw response structure to understand API format
      if (batchCount === 0) {
        console.log(`[Polymarket] First batch response structure:`, {
          isArray: Array.isArray(batchEvents),
          hasData: !!batchEvents?.data,
          hasEvents: !!batchEvents?.events,
          hasResults: !!batchEvents?.results,
          keys: Object.keys(batchEvents || {}),
          dataLength: Array.isArray(batchEvents?.data) ? batchEvents.data.length : 'N/A',
          eventsLength: Array.isArray(batchEvents?.events) ? batchEvents.events.length : 'N/A',
        });
      }
      
      // Handle different response formats
      let events: any[] = [];
      if (Array.isArray(batchEvents)) {
        events = batchEvents;
      } else if (batchEvents?.data && Array.isArray(batchEvents.data)) {
        events = batchEvents.data;
      } else if (batchEvents?.events && Array.isArray(batchEvents.events)) {
        events = batchEvents.events;
      } else if (batchEvents?.results && Array.isArray(batchEvents.results)) {
        events = batchEvents.results;
      }
      
      // If we got no events, we've reached the end
      if (events.length === 0) {
        console.log(`[Polymarket] No events returned at offset ${offset}, pagination complete`);
        hasMore = false;
        break;
      }
      
      // Concatenate results into allRawEvents array
      allRawEvents.push(...events);
      batchCount++;
      
      console.log(`[Polymarket] Batch ${batchCount}: Received ${events.length} events (Total: ${allRawEvents.length})`);
      
      // IMPORTANT: Continue pagination even if we got fewer than batchSize
      // The API might return fewer items per page, but there could be more pages
      // Only stop if we got exactly 0 events (which we already handled above)
      // OR if we've hit the safety limit
      
      // If we got fewer than batchSize, try one more page to be sure
      if (events.length < batchSize) {
        console.log(`[Polymarket] Received ${events.length} events (< ${batchSize}), checking for more pages...`);
        // Try fetching next page to see if there's more data
        const nextOffset = offset + batchSize;
        const nextUrl = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=${batchSize}&offset=${nextOffset}`;
        
        try {
          const nextResponse = await fetch(nextUrl, { 
            method: 'GET', 
            headers: { 'Content-Type': 'application/json' }, 
            cache: 'no-store' 
          });
          
          if (nextResponse.ok) {
            const nextBatch = await nextResponse.json();
            let nextEvents: any[] = [];
            if (Array.isArray(nextBatch)) {
              nextEvents = nextBatch;
            } else if (nextBatch?.data && Array.isArray(nextBatch.data)) {
              nextEvents = nextBatch.data;
            } else if (nextBatch?.events && Array.isArray(nextBatch.events)) {
              nextEvents = nextBatch.events;
            } else if (nextBatch?.results && Array.isArray(nextBatch.results)) {
              nextEvents = nextBatch.results;
            }
            
            if (nextEvents.length > 0) {
              console.log(`[Polymarket] Found ${nextEvents.length} more events on next page, continuing pagination...`);
              // Don't break - continue the loop to fetch this page properly
            } else {
              console.log(`[Polymarket] Next page is empty, pagination complete`);
              hasMore = false;
              break;
            }
          } else {
            console.log(`[Polymarket] Next page request failed (${nextResponse.status}), assuming pagination complete`);
            hasMore = false;
            break;
          }
        } catch (e) {
          console.log(`[Polymarket] Error checking next page:`, e);
          hasMore = false;
          break;
        }
      }
      
      // Update offset for next iteration
      offset += batchSize;
      
      // Check safety limit
      if (allRawEvents.length >= safetyLimit) {
        console.log(`[Polymarket] Reached safety limit of ${safetyLimit} items, stopping pagination`);
        hasMore = false;
        break;
      }
      
      // Small delay to avoid rate limiting (reduced from 100ms to 50ms for speed)
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`[Polymarket] Pagination complete: Fetched ${allRawEvents.length} total events across ${batchCount} batches`);
    const rawEvents = allRawEvents;

    const processed = rawEvents.map((event: any) => {
      const markets = event.markets || [];
      
      // For events like "Super Bowl Champion 2026", we need to combine ALL markets
      // Each market might represent one outcome (e.g., one team), so we collect all outcomes
      const allIndexedOutcomes: MarketOutcome[] = [];
      const seenOutcomeNames = new Set<string>();
      
      // Process ALL ACTIVE markets in the event to collect all outcomes
      // IMPORTANT: Include ALL markets, even if they appear inactive, to catch "Up or Down" markets
      // Some markets might have active=true but appear inactive due to low volume
      // Filter out only explicitly closed markets
      const activeMarkets = markets.filter((m: any) => {
        // Include if active OR if it's an "Up or Down" market (these are always short-term)
        const isUpOrDown = (m.question || m.title || '').toLowerCase().includes('up or down') ||
                          (m.question || m.title || '').toLowerCase().includes('up/down');
        return (m.active && !m.closed) || isUpOrDown;
      });
      
      activeMarkets.forEach((m: any, marketIndex: number) => {
        try {
          // Try to parse outcomes from this market
          let rawNames: string[] = [];
          let rawPrices: any[] = [];
          
          if (m.outcomes) {
            const parsed = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : m.outcomes;
            rawNames = Array.isArray(parsed) ? parsed.map((o: any) => 
              typeof o === 'string' ? o : (o.title || o.name || o.label || String(o))
            ) : [];
          }
          
          if (m.outcomePrices) {
            const parsed = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
            rawPrices = Array.isArray(parsed) ? parsed : [];
          }
          
          // Check if this is a binary market (2 outcomes like YES/NO), multi-choice (3+), or single-outcome
          if (rawNames.length === 2) {
            // Binary market (YES/NO, UP/DOWN, etc.) - add both outcomes
            rawNames.forEach((name: string, index: number) => {
              const cleanName = name.trim();
              if (!seenOutcomeNames.has(cleanName)) {
                seenOutcomeNames.add(cleanName);
                
                // Get price for this specific outcome - prioritize real-time data from Polymarket
                let outcomePrice = 0.5;
                
                // First, try outcomePrices array (most accurate)
                if (rawPrices.length > index && parseFloat(rawPrices[index]) > 0) {
                  outcomePrice = parseFloat(rawPrices[index]);
                } 
                // For active markets, use real-time prices from Polymarket API
                else if (m.active && !m.closed) {
                  // For YES/UP (index 0), use bestBid (what buyers are willing to pay)
                  if (index === 0) {
                    if (m.bestBid && parseFloat(m.bestBid) > 0) {
                      outcomePrice = parseFloat(m.bestBid);
                    } else if (m.lastTradePrice && parseFloat(m.lastTradePrice) > 0) {
                      outcomePrice = parseFloat(m.lastTradePrice);
                    } else if (m.bestAsk && parseFloat(m.bestAsk) > 0) {
                      outcomePrice = parseFloat(m.bestAsk) - 0.01; // Slightly below ask
                    }
                  } 
                  // For NO/DOWN (index 1), use bestAsk or calculate from YES price
                  else if (index === 1) {
                    if (m.bestAsk && parseFloat(m.bestAsk) > 0) {
                      outcomePrice = parseFloat(m.bestAsk);
                    } else if (m.lastTradePrice && parseFloat(m.lastTradePrice) > 0) {
                      outcomePrice = parseFloat(m.lastTradePrice);
                    } else if (m.bestBid && parseFloat(m.bestBid) > 0) {
                      // If we have YES price, NO = 1 - YES
                      outcomePrice = 1 - parseFloat(m.bestBid);
                    }
                  }
                }
                
                // Ensure price is between 0 and 1
                outcomePrice = Math.max(0, Math.min(1, outcomePrice));
                
                allIndexedOutcomes.push({
                  id: `${m.id || event.id}-${allIndexedOutcomes.length}`,
                  name: cleanName,
                  price: outcomePrice,
                  tokenId: m.clobTokenIds ? (JSON.parse(m.clobTokenIds)[index] || null) : null
                });
              }
            });
          } else if (rawNames.length > 2) {
            // Multi-choice market (e.g., election with multiple candidates)
            rawNames.forEach((name: string, index: number) => {
              const cleanName = name.trim();
              if (!seenOutcomeNames.has(cleanName)) {
                seenOutcomeNames.add(cleanName);
                allIndexedOutcomes.push({
                  id: `${m.id || event.id}-${allIndexedOutcomes.length}`,
                  name: cleanName,
                  price: parseFloat(rawPrices[index]) || 0.5,
                  tokenId: m.clobTokenIds ? (JSON.parse(m.clobTokenIds)[index] || null) : null
                });
              }
            });
          } else if (rawNames.length === 1) {
            // Single outcome name in the array - use it directly
            const cleanName = rawNames[0].trim();
            if (!seenOutcomeNames.has(cleanName)) {
              seenOutcomeNames.add(cleanName);
              
              let outcomePrice = 0.5;
              if (rawPrices.length > 0 && parseFloat(rawPrices[0]) > 0) {
                outcomePrice = parseFloat(rawPrices[0]);
              } else if (m.active && !m.closed) {
                if (m.bestBid && parseFloat(m.bestBid) > 0) {
                  outcomePrice = parseFloat(m.bestBid);
                } else if (m.lastTradePrice && parseFloat(m.lastTradePrice) > 0) {
                  outcomePrice = parseFloat(m.lastTradePrice);
                } else if (m.bestAsk && parseFloat(m.bestAsk) > 0) {
                  outcomePrice = parseFloat(m.bestAsk) - 0.01;
                }
              }
              
              outcomePrice = Math.max(0, Math.min(1, outcomePrice));
              
              allIndexedOutcomes.push({
                id: `${m.id || event.id}-${allIndexedOutcomes.length}`,
                name: cleanName,
                price: outcomePrice,
                tokenId: m.clobTokenIds ? (JSON.parse(m.clobTokenIds)[0] || undefined) : undefined
              });
            }
          } else {
            // No outcomes array - this is a single-outcome market (e.g., "Will Team X win?" where each market = one team)
            // Extract the outcome name from groupItemTitle, question, or parse from question
            let outcomeName = '';
            
            // First try groupItemTitle (e.g., "Arizona", "Atlanta" for Super Bowl teams)
            if (m.groupItemTitle) {
              outcomeName = m.groupItemTitle.trim();
            } else {
              // Parse from question (e.g., "Will the Arizona Cardinals win Super Bowl 2026?" -> "Arizona Cardinals")
              const question = m.question || m.title || '';
              
              // Try to extract team name from question patterns
              const patterns = [
                /Will the (.+?) win/i,
                /Will (.+?) win/i,
                /(.+?) to win/i,
                /(.+?) will win/i,
                /^(.+?)\s+(to|will)\s+win/i,
              ];
              
              for (const pattern of patterns) {
                const match = question.match(pattern);
                if (match && match[1]) {
                  outcomeName = match[1].trim();
                  break;
                }
              }
              
              // If no pattern match, try to extract from common formats
              if (!outcomeName) {
                // Remove common prefixes
                outcomeName = question
                  .replace(/^Will (the )?/i, '')
                  .replace(/\s+win.*$/i, '')
                  .replace(/\s+to\s+win.*$/i, '')
                  .trim();
              }
              
              // If still empty, use a cleaned version of the question
              if (!outcomeName || outcomeName.length < 2) {
                outcomeName = question.length > 50 ? question.substring(0, 50) + '...' : question;
              }
            }
            
            if (outcomeName && !seenOutcomeNames.has(outcomeName)) {
              seenOutcomeNames.add(outcomeName);
              
              // Get price - prioritize real-time data from active markets
              let marketPrice = 0.5;
              
              // For active markets, use real-time prices
              if (m.active && !m.closed) {
                // Try bestBid first (most recent willing buyer price)
                if (m.bestBid && parseFloat(m.bestBid) > 0) {
                  marketPrice = parseFloat(m.bestBid);
                } 
                // Then try lastTradePrice
                else if (m.lastTradePrice && parseFloat(m.lastTradePrice) > 0) {
                  marketPrice = parseFloat(m.lastTradePrice);
                }
                // Then try bestAsk (subtract a small amount to get mid-price)
                else if (m.bestAsk && parseFloat(m.bestAsk) > 0) {
                  marketPrice = parseFloat(m.bestAsk) - 0.01;
                }
                // Fallback to outcomePrices if available
                else if (rawPrices.length >= 1 && parseFloat(rawPrices[0]) > 0) {
                  marketPrice = parseFloat(rawPrices[0]);
                }
              } else {
                // For closed markets, use outcomePrices
                if (rawPrices.length >= 1) {
                  marketPrice = parseFloat(rawPrices[0]) || 0.5;
                }
              }
              
              // Ensure price is between 0 and 1
              marketPrice = Math.max(0, Math.min(1, marketPrice));
              
              allIndexedOutcomes.push({
                id: `${m.id || event.id}-${allIndexedOutcomes.length}`,
                name: outcomeName,
                price: marketPrice,
                tokenId: m.clobTokenIds ? (JSON.parse(m.clobTokenIds)[0] || undefined) : undefined
              });
            }
          }
        } catch (e) {
          console.warn('Failed to parse market outcomes:', e);
        }
      });
      
      // Fallback to YES/NO if no outcomes found from active markets
      // Special handling for "Up or Down" markets
      if (allIndexedOutcomes.length === 0) {
        // Check if this is an "Up or Down" market
        const isUpOrDown = (event.title || '').toLowerCase().includes('up or down') ||
                          (event.title || '').toLowerCase().includes('up/down') ||
                          markets.some((m: any) => 
                            (m.question || m.title || '').toLowerCase().includes('up or down') ||
                            (m.question || m.title || '').toLowerCase().includes('up/down')
                          );
        
        if (isUpOrDown) {
          // "Up or Down" markets should have "Up" and "Down" outcomes
          allIndexedOutcomes.push(
            { id: `${event.id}-up`, name: 'Up', price: 0.5, tokenId: undefined },
            { id: `${event.id}-down`, name: 'Down', price: 0.5, tokenId: undefined }
          );
        } else {
          // Try to use the first active market, or fall back to any market
          const firstMarket = activeMarkets[0] || markets[0] || {};
          const rawNames = firstMarket.outcomes ? 
            (typeof firstMarket.outcomes === 'string' ? JSON.parse(firstMarket.outcomes) : firstMarket.outcomes) : 
            ["YES", "NO"];
          const rawPrices = firstMarket.outcomePrices ? 
            (typeof firstMarket.outcomePrices === 'string' ? JSON.parse(firstMarket.outcomePrices) : firstMarket.outcomePrices) : 
            ["0.5", "0.5"];
          
          allIndexedOutcomes.push(
            ...rawNames.map((name: string, index: number) => ({
              id: `${firstMarket.id || event.id}-${index}`,
              name: name.trim(),
              price: parseFloat(rawPrices[index]) || 0.5,
              tokenId: firstMarket.clobTokenIds ? (JSON.parse(firstMarket.clobTokenIds)[index] || null) : null
            }))
          );
        }
      }
      
      // Use the first market for metadata (id, conditionId, etc.)
      const m = markets[0] || {};
      
      // IMPORTANT: For events like Super Bowl, we MUST collect ALL markets as outcomes
      // Even if we already have some outcomes, we need to ensure we get ALL teams/options
      // Process ALL markets in the event to ensure we don't miss any outcomes
      if (markets.length > 0 && allIndexedOutcomes.length < markets.length) {
        // We might be missing outcomes - check all markets again
        markets.forEach((market: any) => {
          // Skip if market is closed/inactive (unless we have no outcomes at all)
          if (!market.active || market.closed) {
            if (allIndexedOutcomes.length > 0) return; // Skip inactive if we have outcomes
          }
          
          // Try to get outcome name from groupItemTitle first (most reliable for Super Bowl teams)
          let outcomeName = '';
          if (market.groupItemTitle) {
            outcomeName = market.groupItemTitle.trim();
          } else {
            // Parse from question
            const question = market.question || market.title || '';
            const patterns = [
              /Will the (.+?) win/i,
              /Will (.+?) win/i,
              /(.+?) to win/i,
              /(.+?) will win/i,
              /^(.+?)\s+(to|will)\s+win/i,
            ];
            
            for (const pattern of patterns) {
              const match = question.match(pattern);
              if (match && match[1]) {
                outcomeName = match[1].trim();
                break;
              }
            }
            
            if (!outcomeName) {
              outcomeName = question
                .replace(/^Will (the )?/i, '')
                .replace(/\s+win.*$/i, '')
                .replace(/\s+to\s+win.*$/i, '')
                .trim();
            }
          }
          
          // Only add if we don't already have this outcome
          if (outcomeName && !seenOutcomeNames.has(outcomeName)) {
            seenOutcomeNames.add(outcomeName);
            
            // Get price
            let price = 0.5;
            if (market.outcomePrices) {
              try {
                const prices = typeof market.outcomePrices === 'string' ? 
                  JSON.parse(market.outcomePrices) : market.outcomePrices;
                if (Array.isArray(prices) && prices.length > 0) {
                  price = parseFloat(prices[0]) || 0.5;
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
            
            if (price === 0.5 && market.active && !market.closed) {
              price = parseFloat(market.lastTradePrice) || 
                     parseFloat(market.bestBid) || 
                     (parseFloat(market.bestAsk) ? parseFloat(market.bestAsk) - 0.01 : 0.5);
            }
            
            allIndexedOutcomes.push({
              id: `${market.id || event.id}-${allIndexedOutcomes.length}`,
              name: outcomeName,
              price: Math.max(0, Math.min(1, price)),
              tokenId: market.clobTokenIds ? (JSON.parse(market.clobTokenIds)[0] || undefined) : undefined
            });
          }
        });
      }
      
      // Also check if the event itself has outcome information
      // Some events might have outcomes directly in the event object
      if (allIndexedOutcomes.length === 0 && event.outcomes) {
        try {
          const eventOutcomes = typeof event.outcomes === 'string' ? 
            JSON.parse(event.outcomes) : event.outcomes;
          const eventPrices = event.outcomePrices ? 
            (typeof event.outcomePrices === 'string' ? JSON.parse(event.outcomePrices) : event.outcomePrices) : 
            [];
          
          if (Array.isArray(eventOutcomes)) {
            eventOutcomes.forEach((name: string, index: number) => {
              if (!seenOutcomeNames.has(name.trim())) {
                seenOutcomeNames.add(name.trim());
                allIndexedOutcomes.push({
                  id: `${event.id}-${allIndexedOutcomes.length}`,
                  name: name.trim(),
                  price: parseFloat(eventPrices[index]) || 0.5,
                  tokenId: undefined
                });
              }
            });
          }
        } catch (e) {
          console.warn('Failed to parse event outcomes:', e);
        }
      }

      const totalVolume = parseFloat(event.volume) || 0;
      
      // Formatting Volume
      let formattedVol = "$0";
      if (totalVolume >= 1000000) formattedVol = `$${(totalVolume / 1000000).toFixed(1)}M`;
      else if (totalVolume >= 1000) formattedVol = `$${(totalVolume / 1000).toFixed(0)}K`;
      else formattedVol = `$${totalVolume.toFixed(0)}`;

      // Use Polymarket's actual category from the API, with intelligent fallback
      // Polymarket API returns categories as an array: [{ id, label, slug }]
      let category = "General";
      
      // Step 1: Try to get category from Polymarket API
      if (event.categories && Array.isArray(event.categories) && event.categories.length > 0) {
        // Use the first category's label (Polymarket's primary category)
        const primaryCategory = event.categories[0];
        category = primaryCategory.label || primaryCategory.name || primaryCategory.slug || "General";
      }
      // Check other possible category fields
      else if (event.category) {
        category = event.category;
      }
      else if (event.categoryName) {
        category = event.categoryName;
      }
      else if (event.tags && Array.isArray(event.tags) && event.tags.length > 0) {
        // Some events use tags instead of categories
        const firstTag = event.tags[0];
        category = firstTag.name || firstTag.label || firstTag.slug || "General";
      }
      else if (event.group?.category) {
        category = event.group.category;
      }
      
      // Step 2: ALWAYS use intelligent keyword detection as primary method
      // API categories might be missing or incorrect, so we prioritize keyword detection
      // Only use API category if keyword detection doesn't find anything
      let detectedCategory = "";
      const title = (event.title || "").toLowerCase();
      const description = (event.description || "").toLowerCase();
      const combined = `${title} ${description}`;
      
      // Check market questions too (markets within events might have different topics)
      const marketQuestions = (markets || []).map((m: any) => 
        ((m.question || m.title || "").toLowerCase() + " " + (m.description || "").toLowerCase())
      ).join(" ");
      const allText = `${combined} ${marketQuestions}`;
      
      // Crypto detection (comprehensive) - check ALL text
      // Also detect "Up or Down" markets which are common for crypto
      if (allText.includes("bitcoin") || allText.includes("btc") || allText.includes("ethereum") ||
            allText.includes("eth") || allText.includes("crypto") || allText.includes("blockchain") ||
            allText.includes("defi") || allText.includes("nft") || allText.includes("coin") ||
            allText.includes("token") || allText.includes("solana") || allText.includes("sol") ||
            allText.includes("cardano") || allText.includes("ada") || allText.includes("polygon") ||
            allText.includes("matic") || allText.includes("avalanche") || allText.includes("avax") ||
            allText.includes("chainlink") || allText.includes("link") || allText.includes("uniswap") ||
            allText.includes("doge") || allText.includes("shib") || allText.includes("meme coin") ||
            allText.includes("stablecoin") || allText.includes("usdt") || allText.includes("usdc") ||
            allText.includes("binance") || allText.includes("bnb") || allText.includes("exchange") ||
            allText.includes("fdv") || allText.includes("airdrop") || allText.includes("launch") ||
            // "Up or Down" markets are typically crypto
            (allText.includes("up or down") || allText.includes("up/down")) ||
            // Time-based crypto markets (e.g., "6:00AM-6:15AM ET")
            (allText.includes("am et") || allText.includes("pm et") || allText.includes(":") && allText.includes("et"))) {
        detectedCategory = "Crypto";
      }
      // Sports detection (comprehensive) - check ALL text
      else if (allText.includes("nba") || allText.includes("nfl") || allText.includes("nhl") || 
                 allText.includes("mlb") || allText.includes("soccer") || allText.includes("football") ||
                 allText.includes("basketball") || allText.includes("hockey") || allText.includes("baseball") ||
                 allText.includes(" vs ") || allText.includes("winner") || allText.includes("champion") ||
                 allText.includes("super bowl") || allText.includes("stanley cup") || allText.includes("world series") ||
                 allText.includes("olympics") || allText.includes("esports") || allText.includes("gaming") ||
                 allText.includes("tennis") || allText.includes("golf") || allText.includes("mma") ||
                 allText.includes("ufc") || allText.includes("boxing") || allText.includes("soccer") ||
                 allText.includes("premier league") || allText.includes("champions league") || allText.includes("ncaa") ||
                 allText.includes("college") || allText.includes("playoff") || allText.includes("championship") ||
                 allText.includes("game") || allText.includes("match") || allText.includes("tournament") ||
                 allText.includes("presidents' trophy") || allText.includes("division winner") ||
                 allText.includes("draft") || allText.includes("wrexham") || allText.includes("fifa")) {
        detectedCategory = "Sports";
      }
      // Finance detection (comprehensive) - check ALL text
      else if (allText.includes("fed") || allText.includes("federal reserve") || allText.includes("interest rate") ||
                 allText.includes("inflation") || allText.includes("cpi") || allText.includes("gdp") ||
                 allText.includes("unemployment") || allText.includes("stock") || allText.includes("s&p") ||
                 allText.includes("sp500") || allText.includes("dow") || allText.includes("nasdaq") ||
                 allText.includes("recession") || allText.includes("yield") || allText.includes("bond") ||
                 allText.includes("treasury") || allText.includes("crude oil") || allText.includes("oil price") ||
                 allText.includes("gold price") || allText.includes("silver") || allText.includes("commodity") ||
                 allText.includes("forex") || allText.includes("currency") || allText.includes("dollar") ||
                 allText.includes("euro") || allText.includes("yen") || allText.includes("pound") ||
                 allText.includes("market cap") || allText.includes("earnings") || allText.includes("revenue") ||
                 allText.includes("profit") || allText.includes("loss") || allText.includes("quarterly") ||
                 allText.includes("fiscal") || allText.includes("monetary policy") || allText.includes("rate cut") ||
                 allText.includes("rate hike") || allText.includes("jobs report") || allText.includes("nfp") ||
                 allText.includes("treasury") || allText.includes("reserve") || allText.includes("bank")) {
        detectedCategory = "Finance";
      }
      // Politics detection - check ALL text
      else if (allText.includes("election") || allText.includes("president") || allText.includes("senate") || 
                 allText.includes("congress") || allText.includes("trump") || allText.includes("biden") ||
                 allText.includes("primaries") || allText.includes("midterms") || allText.includes("vote") ||
                 allText.includes("poll") || allText.includes("candidate") || allText.includes("democrat") ||
                 allText.includes("republican") || allText.includes("senator") || allText.includes("governor")) {
        detectedCategory = "Politics";
      }
      // Tech detection - check ALL text
      else if (allText.includes("apple") || allText.includes("google") || allText.includes("microsoft") ||
                 allText.includes("meta") || allText.includes("facebook") || allText.includes("tesla") ||
                 allText.includes("ai") || allText.includes("artificial intelligence") || allText.includes("chatgpt") ||
                 allText.includes("ipo") || allText.includes("earnings") || allText.includes("tech") ||
                 allText.includes("amazon") || allText.includes("netflix") || allText.includes("nvidia") ||
                 allText.includes("amd") || allText.includes("intel") || allText.includes("semiconductor")) {
        detectedCategory = "Tech";
      }
      // World/Geopolitics detection - check ALL text
      else if (allText.includes("russia") || allText.includes("ukraine") || allText.includes("china") ||
                 allText.includes("iran") || allText.includes("israel") || allText.includes("palestine") ||
                 allText.includes("war") || allText.includes("conflict") || allText.includes("ceasefire") ||
                 allText.includes("nato") || allText.includes("un") || allText.includes("sanctions") ||
                 allText.includes("trade war") || allText.includes("tariff") || allText.includes("embargo")) {
        detectedCategory = "Geopolitics";
      }
      // Culture detection - check ALL text
      else if (allText.includes("oscar") || allText.includes("grammy") || allText.includes("emmy") ||
                 allText.includes("movie") || allText.includes("film") || allText.includes("music") ||
                 allText.includes("celebrity") || allText.includes("award") || allText.includes("entertainment") ||
                 allText.includes("tv") || allText.includes("television") || allText.includes("streaming") ||
                 allText.includes("taylor swift") || allText.includes("gta")) {
        detectedCategory = "Culture";
      }
      // Economy detection - check ALL text
      else if (allText.includes("economy") || allText.includes("economic") || allText.includes("trade") ||
                 allText.includes("tariff") || allText.includes("currency") || allText.includes("dollar") ||
                 allText.includes("euro") || allText.includes("yen") || allText.includes("market cap")) {
        detectedCategory = "Economy";
      }
      // Climate & Science detection - check ALL text
      else if (allText.includes("climate") || allText.includes("global warming") || allText.includes("temperature") ||
                 allText.includes("carbon") || allText.includes("emission") || allText.includes("renewable") ||
                 allText.includes("solar") || allText.includes("wind") || allText.includes("nuclear") ||
                 allText.includes("space") || allText.includes("nasa") || allText.includes("mars") ||
                 allText.includes("scientific") || allText.includes("research") || allText.includes("study")) {
        detectedCategory = "Climate & Science";
      }
      // Earnings detection
      else if (allText.includes("earnings") || allText.includes("q1") || allText.includes("q2") ||
               allText.includes("q3") || allText.includes("q4") || allText.includes("quarter")) {
        detectedCategory = "Earnings";
      }
      
      // Use detected category if found, otherwise use API category, otherwise General
      // BUT: Only override if API category is missing or General
      if (detectedCategory && (!category || category === "General" || category.trim() === "")) {
        category = detectedCategory;
      } else if (!category || category === "General" || category.trim() === "") {
        // Only use detected category if API didn't provide one
        if (detectedCategory) {
          category = detectedCategory;
        } else {
          category = "General";
        }
      }
      // Otherwise keep the API category (it's more reliable)
      
      // Step 3: Normalize category name to match Polymarket's standard format
      if (category && typeof category === 'string') {
        category = category.trim();
        // Capitalize first letter of each word (Polymarket uses title case)
        category = category.split(' ').map((word: string) => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        
        // Map common variations to match Polymarket's exact category names
        const categoryMap: Record<string, string> = {
          'Politics': 'Politics',
          'Political': 'Politics',
          'Election': 'Elections',
          'Elections': 'Elections',
          'Sports': 'Sports',
          'Sport': 'Sports',
          'Crypto': 'Crypto',
          'Cryptocurrency': 'Crypto',
          'Cryptocurrencies': 'Crypto',
          'Finance': 'Finance',
          'Financial': 'Finance',
          'Tech': 'Tech',
          'Technology': 'Tech',
          'Culture': 'Culture',
          'Entertainment': 'Culture',
          'World': 'World',
          'Geopolitics': 'Geopolitics',
          'Economy': 'Economy',
          'Economic': 'Economy',
          'Climate': 'Climate & Science',
          'Science': 'Climate & Science',
          'Earnings': 'Earnings',
        };
        
        category = categoryMap[category] || category;
      }
      
      // Log category assignment for debugging (only for first few markets)
      if (rawEvents.indexOf(event) < 5) {
        console.log(`[Category] Event: "${event.title?.substring(0, 50)}" -> Category: "${category}"`);
      }

      return {
        id: m.id || event.id,
        conditionId: m.conditionId || m.id || event.id,
        provider: "Polymarket" as const,
        name: event.title || m.question || "Unknown Event",
        description: event.description || "",
        price: allIndexedOutcomes.length > 0 ? allIndexedOutcomes[0].price : 0.5,
        outcomes: allIndexedOutcomes, // ALL choices (2 or 20) are now here
        imageUrl: event.image || event.icon || "https://polymarket.com/favicon.ico",
        slug: event.slug,
        polymarketUrl: `https://polymarket.com/event/${event.slug}`,
        volume: totalVolume,
        volumeFormatted: formattedVol,
        category: category,
        last_updated: new Date().toISOString(),
        resolutionDate: event.endDate || "",
        change: parseFloat(m.priceChange24h) || 0,
      };
    });

    const now = new Date();
    const filtered = processed
      .filter((m: any) => {
        // Only filter out:
        // 1. Zombie Markets (2018-2023) - old resolved markets
        if (m.name && (m.name.includes("2018") || m.name.includes("2023"))) return false;
        // 2. Already resolved markets (past resolution date)
        // BUT: Be lenient - if it's an "Up or Down" market, include it even if date seems past
        const isUpOrDown = (m.name || '').toLowerCase().includes('up or down') ||
                          (m.name || '').toLowerCase().includes('up/down');
        if (m.resolutionDate && !isUpOrDown) {
          try {
            const resDate = new Date(m.resolutionDate);
            // Add 1 hour buffer to account for timezone issues
            const bufferTime = new Date(now.getTime() + 60 * 60 * 1000);
            if (resDate < bufferTime) return false;
          } catch (e) {
            // If date parsing fails, include the market
          }
        }
        // 3. Markets with no outcomes (invalid markets)
        // BUT: "Up or Down" markets might have outcomes in a different format
        if (!m.outcomes || m.outcomes.length === 0) {
          // If it's an "Up or Down" market, create default outcomes
          if (isUpOrDown) {
            // This will be handled by the processing logic, so include it
            return true;
          }
          return false;
        }
        
        // Include ALL other markets regardless of volume
        // This ensures we get every single market from Polymarket, including low-volume "Up or Down" markets
        return true;
      });
    
    // Count markets by category for debugging
    const categoryCounts: Record<string, number> = {};
    let upOrDownCount = 0;
    let timeRangeCount = 0;
    filtered.forEach((m: any) => {
      const cat = m.category || 'General';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      
      // Count "Up or Down" markets
      const name = (m.name || '').toLowerCase();
      if (name.includes('up or down') || name.includes('up/down')) {
        upOrDownCount++;
      }
      
      // Count time-range markets (e.g., "6:00AM-6:15AM ET")
      if (name.includes(':') && name.includes('et') && (name.includes('-') || name.includes(' to '))) {
        timeRangeCount++;
      }
    });
    
    console.log(`[Polymarket] Processed ${processed.length} events, ${filtered.length} valid markets after filtering`);
    console.log(`[Polymarket] Category distribution:`, categoryCounts);
    console.log(`[Polymarket] "Up or Down" markets: ${upOrDownCount}, Time-range markets: ${timeRangeCount}`);
    
    // FINAL SORT: Sort by volume descending (highest first) to ensure Trending markets remain at the top
    // This is critical for maintaining proper market ordering after multi-page pagination
    const sortedMarkets = filtered.sort((a: any, b: any) => b.volume - a.volume);
    
    console.log(`[Polymarket] Final sorted markets: ${sortedMarkets.length} (Top 10 volumes: ${sortedMarkets.slice(0, 10).map((m: any) => m.volume).join(', ')})`);
    
    return sortedMarkets;

  } catch (error) {
    console.error(`[Polymarket] Error fetching markets:`, error);
    if (error instanceof Error) {
      console.error(`[Polymarket] Error message:`, error.message);
      console.error(`[Polymarket] Error stack:`, error.stack);
    }
    return []; 
  }
}

// ============================================================================
// KALSHI MARKET FETCHER
// ============================================================================

/**
 * Kalshi category mapping to our standard categories.
 * Kalshi uses event_ticker prefixes and series_ticker to indicate category.
 */
function mapKalshiCategory(event: any): string {
  const title = (event.title || '').toLowerCase();
  const category = (event.category || '').toLowerCase();
  const ticker = (event.event_ticker || event.ticker || '').toUpperCase();

  // ── Direct Kalshi category mapping (most reliable) ──
  // Kalshi categories: "Economics", "Financials", "Politics", "Climate and Weather",
  //   "Science and Technology", "World", "Culture", "Health", etc.
  if (category.includes('financials') || category.includes('economics') || category.includes('finance')) return 'Finance';
  if (category.includes('politics') || category.includes('election')) return 'Politics';
  if (category.includes('climate') || category.includes('weather') || category.includes('science')) return 'Climate & Science';
  if (category.includes('tech')) return 'Tech';
  if (category.includes('crypto')) return 'Crypto';
  if (category.includes('culture') || category.includes('entertainment')) return 'Culture';
  if (category.includes('world') || category.includes('geopolitics')) return 'Geopolitics';
  if (category.includes('health')) return 'General';
  if (category.includes('sports')) return 'Sports';

  // ── Ticker-prefix detection (Kalshi convention) ──
  if (ticker.startsWith('KXNBA') || ticker.startsWith('KXNFL') || ticker.startsWith('KXNHL') ||
      ticker.startsWith('KXMLB') || ticker.startsWith('KXMVE') || ticker.startsWith('KXNCAA') ||
      ticker.startsWith('KXSOCCER') || ticker.startsWith('KXUFC') || ticker.startsWith('KXMMA') ||
      ticker.startsWith('KXPGA') || ticker.startsWith('KXTENNIS') || ticker.startsWith('KXEPL') ||
      ticker.startsWith('KXUCL') || ticker.startsWith('KXLIGUE') || ticker.startsWith('KXLALIGA') ||
      ticker.startsWith('KXBUND') || ticker.startsWith('KXSERIE')) {
    return 'Sports';
  }
  if (ticker.startsWith('KXBTC') || ticker.startsWith('KXETH') || ticker.startsWith('KXSOL') ||
      ticker.startsWith('KXCRYPTO')) {
    return 'Crypto';
  }
  if (ticker.startsWith('KXFED') || ticker.startsWith('KXCPI') || ticker.startsWith('KXGDP') ||
      ticker.startsWith('KXRATE') || ticker.startsWith('KXINF') || ticker.startsWith('KXJOB') ||
      ticker.startsWith('KXUNEMPLOY') || ticker.startsWith('KXSP5') || ticker.startsWith('KXNASDAQ') ||
      ticker.startsWith('KXDOW') || ticker.startsWith('KXTSLA') || ticker.startsWith('KXAAPL')) {
    return 'Finance';
  }
  if (ticker.startsWith('KXPRES') || ticker.startsWith('KXELEC') || ticker.startsWith('KXSEN') ||
      ticker.startsWith('KXGOV') || ticker.startsWith('KXDEM') || ticker.startsWith('KXREP') ||
      ticker.startsWith('KXTRUMP') || ticker.startsWith('KXBIDEN') || ticker.startsWith('KXCONGRESS')) {
    return 'Politics';
  }

  // ── Title-based keyword detection ──
  // Sports keywords (catches player props, game markets, etc.)
  if (title.includes('nba') || title.includes('nfl') || title.includes('nhl') || title.includes('mlb') ||
      title.includes('super bowl') || title.includes('world series') || title.includes('stanley cup') ||
      title.includes('soccer') || title.includes('football') || title.includes('basketball') ||
      title.includes('baseball') || title.includes('hockey') || title.includes('ufc') ||
      title.includes('tennis') || title.includes('golf') || title.includes(' vs ') ||
      title.includes('game') || title.includes('match') || title.includes('playoffs') ||
      title.includes('championship') || title.includes('points') || title.includes('rebounds') ||
      title.includes('assists') || title.includes('yards') || title.includes('touchdowns') ||
      title.includes('goals') || title.includes('winner') || title.includes('champion') ||
      title.includes('premier league') || title.includes('champions league') ||
      title.includes('ncaa') || title.includes('college') || title.includes('draft') ||
      title.includes('mvp') || title.includes('season') || title.includes('series') ||
      title.includes('olympic')) {
    return 'Sports';
  }
  // Crypto
  if (title.includes('bitcoin') || title.includes('btc') || title.includes('ethereum') ||
      title.includes('eth') || title.includes('crypto') || title.includes('blockchain') ||
      title.includes('solana') || title.includes('defi') || title.includes('nft')) {
    return 'Crypto';
  }
  // Finance
  if (title.includes('fed') || title.includes('interest rate') || title.includes('inflation') ||
      title.includes('cpi') || title.includes('gdp') || title.includes('jobs') ||
      title.includes('unemployment') || title.includes('s&p') || title.includes('nasdaq') ||
      title.includes('stock') || title.includes('treasury') || title.includes('yield') ||
      title.includes('recession') || title.includes('tariff') || title.includes('rate cut') ||
      title.includes('rate hike') || title.includes('earnings')) {
    return 'Finance';
  }
  // Politics
  if (title.includes('election') || title.includes('president') || title.includes('congress') ||
      title.includes('senate') || title.includes('vote') || title.includes('trump') ||
      title.includes('biden') || title.includes('democrat') || title.includes('republican') ||
      title.includes('governor') || title.includes('legislature') || title.includes('pope') ||
      title.includes('impeach')) {
    return 'Politics';
  }
  // Tech
  if (title.includes('ai ') || title.includes('artificial intelligence') || title.includes('apple') ||
      title.includes('google') || title.includes('microsoft') || title.includes('tesla') ||
      title.includes('nvidia') || title.includes('meta') || title.includes('chatgpt') ||
      title.includes('spacex') || title.includes('elon musk') || title.includes('mars')) {
    return 'Tech';
  }
  // Climate & Science
  if (title.includes('temperature') || title.includes('hurricane') || title.includes('weather') ||
      title.includes('climate') || title.includes('carbon') || title.includes('nasa') ||
      title.includes('volcano') || title.includes('earthquake') || title.includes('warming')) {
    return 'Climate & Science';
  }
  // Geopolitics
  if (title.includes('russia') || title.includes('ukraine') || title.includes('china') ||
      title.includes('war') || title.includes('nato') || title.includes('sanction') ||
      title.includes('ceasefire') || title.includes('north korea') || title.includes('iran')) {
    return 'Geopolitics';
  }
  // Culture
  if (title.includes('oscar') || title.includes('grammy') || title.includes('emmy') ||
      title.includes('movie') || title.includes('celebrity') || title.includes('award') ||
      title.includes('album') || title.includes('streaming')) {
    return 'Culture';
  }

  return 'General';
}

/**
 * Format volume for display
 */
function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
}

/**
 * Fetch markets from Kalshi REST API v2.
 * 
 * Uses the EVENTS endpoint with `with_nested_markets=true` to get both
 * event metadata (titles, categories) and market data (prices, volumes)
 * in a single paginated call — avoids the KXMVE parlay flood issue.
 * 
 * Kalshi URL format: https://kalshi.com/markets/{series_ticker}/{event_ticker}
 * 
 * Requires RSA-PSS authentication via KALSHI_ACCESS_KEY and KALSHI_PRIVATE_KEY.
 */
export async function fetchKalshiMarkets(limit: number = 5000): Promise<UnifiedMarket[]> {
  const HOST = 'https://api.elections.kalshi.com';
  
  const accessKey = process.env.KALSHI_ACCESS_KEY;
  const privateKey = process.env.KALSHI_PRIVATE_KEY;

  if (!accessKey || !privateKey) {
    console.warn(`[Kalshi] Missing KALSHI_ACCESS_KEY or KALSHI_PRIVATE_KEY — skipping`);
    return [];
  }

  /** Authenticated GET helper — signs path (no query string) with RSA-PSS. */
  async function kalshiGet(pathBase: string, params: URLSearchParams): Promise<any> {
    const authHeaders = generateKalshiHeaders('GET', pathBase, accessKey!, privateKey!);
    const url = `${HOST}${pathBase}?${params}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...authHeaders },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${res.status} ${body.slice(0, 200)}`);
    }
    return res.json();
  }

  try {
    console.log(`[Kalshi] Starting event+market fetch (authenticated)...`);

    // ── Paginate through events WITH nested market data ──────────────────
    const unified: UnifiedMarket[] = [];
    let cursor: string | undefined;
    let page = 0;
    let totalEvents = 0;
    let withVolume = 0;

    while (totalEvents < limit) {
      const params = new URLSearchParams({
        status: 'open',
        limit: '200',
        with_nested_markets: 'true',
      });
      if (cursor) params.set('cursor', cursor);

      try {
        const data = await kalshiGet('/trade-api/v2/events', params);
        const events: any[] = data.events || [];
        if (events.length === 0) break;

        for (const event of events) {
          try {
            const eventTicker = event.event_ticker || event.ticker;
            const seriesTicker = event.series_ticker || '';
            const title = event.title || eventTicker;
            const category = event.category || '';
            const subTitle = event.sub_title || '';

            // ── Build from nested markets ──
            const nestedMarkets: any[] = event.markets || [];
            let outcomes: MarketOutcome[] = [];
            let primaryPrice = 0.5;
            let totalVolume = 0;
            let resolutionDate = '';
            let change = 0;
            let rules = '';

            if (nestedMarkets.length > 0) {
              const firstMkt = nestedMarkets[0];
              rules = firstMkt.rules_primary || '';

              outcomes = nestedMarkets.map((m: any, idx: number) => {
                // Price: use best available signal from Kalshi fields
                // Priority: last_price > yes_bid > yes_ask (all in cents 0-100)
                let yesPrice: number;
                if (m.last_price != null && m.last_price > 0) {
                  yesPrice = m.last_price / 100;
                } else if (m.yes_bid != null && m.yes_bid > 0) {
                  yesPrice = m.yes_bid / 100;
                } else if (m.yes_ask != null && m.yes_ask > 0) {
                  yesPrice = m.yes_ask / 100;
                } else {
                  // Truly no data — use a small default
                  yesPrice = 0.01;
                }
                yesPrice = Math.max(0.01, Math.min(0.99, yesPrice));

                // Outcome name: use subtitle or title (cleaned of Kalshi's raw :: prefix)
                let outcomeName = (m.subtitle || m.yes_sub_title || m.title || '')
                  .replace(/^::\s*/g, '')   // strip leading ::
                  .replace(/^--\s*/g, '')   // strip leading --
                  .trim();
                if (!outcomeName || outcomeName === title) {
                  outcomeName = event.mutually_exclusive ? `Option ${idx + 1}` : 'Yes';
                }

                return {
                  id: m.ticker || `${eventTicker}-${idx}`,
                  name: outcomeName,
                  price: yesPrice,
                  tokenId: m.ticker,
                };
              });

              // Use highest-probability outcome as the primary price
              // (multi-choice markets have many low-prob outcomes; show the leader)
              const sortedOutcomes = [...outcomes].sort((a, b) => b.price - a.price);
              primaryPrice = sortedOutcomes[0]?.price ?? 0.5;
              // Re-order outcomes so the leading one is first
              outcomes = sortedOutcomes;

              // Volume: sum across all sub-markets
              totalVolume = nestedMarkets.reduce((sum: number, m: any) => {
                return sum + (m.volume || 0);
              }, 0);

              resolutionDate = firstMkt.expected_expiration_time ||
                               firstMkt.close_time ||
                               firstMkt.expiration_time || '';

              // 24h change
              if (firstMkt.previous_price != null && firstMkt.last_price != null && firstMkt.previous_price > 0) {
                change = (firstMkt.last_price - firstMkt.previous_price) / 100;
              }
            }

            // Skip events with zero volume (no trading activity)
            if (totalVolume === 0) continue;

            if (totalVolume > 0) withVolume++;

            const mappedCategory = mapKalshiCategory({
              title,
              category,
              event_ticker: eventTicker,
            });

            // ── Build Kalshi URL ──
            // Format: https://kalshi.com/markets/{series_ticker}/{event_ticker}
            // Falls back to https://kalshi.com/markets/{event_ticker} if no series
            const kalshiSlug = seriesTicker
              ? `${seriesTicker.toLowerCase()}/${eventTicker.toLowerCase()}`
              : eventTicker.toLowerCase();

            const kalshiUrl = `https://kalshi.com/markets/${kalshiSlug}`;

            // Build image URL — try series ticker, then event ticker prefix, then category-based
            let kalshiImageUrl = '';
            if (seriesTicker) {
              kalshiImageUrl = `https://kalshi-public-docs.s3.amazonaws.com/series-images-webp/${seriesTicker}.webp`;
            } else if (eventTicker) {
              // Try event ticker prefix (e.g., KXBTC from KXBTC-26FEB25)
              const tickerPrefix = eventTicker.split('-')[0];
              if (tickerPrefix) {
                kalshiImageUrl = `https://kalshi-public-docs.s3.amazonaws.com/series-images-webp/${tickerPrefix}.webp`;
              }
            }

            unified.push({
              id: `kalshi-${eventTicker}`,
              conditionId: eventTicker,
              provider: 'Kalshi',
              name: title,
              eventTitle: title + (subTitle ? ` — ${subTitle}` : ''),
              description: rules || subTitle || '',
              price: primaryPrice,
              outcomes,
              imageUrl: kalshiImageUrl,
              polymarketUrl: kalshiUrl, // Used by existing link handlers
              kalshiUrl,
              slug: eventTicker.toLowerCase(),
              volume: totalVolume,
              volumeFormatted: formatVolume(totalVolume),
              category: mappedCategory,
              last_updated: new Date().toISOString(),
              resolutionDate,
              change,
            });
          } catch (err) {
            // skip individual event errors
          }
        }

        totalEvents += events.length;
        page++;
        console.log(`[Kalshi] Events page ${page}: ${events.length} events (total: ${totalEvents}, with volume: ${unified.length})`);

        cursor = data.cursor;
        if (!cursor) break;
        await new Promise(r => setTimeout(r, 30));
      } catch (err) {
        console.warn(`[Kalshi] Events fetch error on page ${page + 1}:`, err);
        break;
      }
    }

    // Sort by volume descending (highest-traded events first)
    unified.sort((a, b) => b.volume - a.volume);

    // Debug: category distribution
    const catCounts: Record<string, number> = {};
    unified.forEach(m => { catCounts[m.category] = (catCounts[m.category] || 0) + 1; });
    console.log(`[Kalshi] ✅ ${unified.length} events with volume out of ${totalEvents} total. Categories:`, catCounts);

    return unified;
  } catch (error) {
    console.error(`[Kalshi] Error fetching markets:`, error);
    if (error instanceof Error) console.error(`[Kalshi] ${error.message}`);
    return [];
  }
}

// ============================================================================
// COMBINED MARKET FETCHER
// ============================================================================

// ═══════════════════════════════════════════════════════════════════
// GLOBAL SERVER-SIDE CACHE — shared across ALL routes (trending, 
// markets, terminal). One fetch fills the cache; every subsequent
// request within the TTL gets an instant response.
// ═══════════════════════════════════════════════════════════════════
let _allMarketsCache: UnifiedMarket[] | null = null;
let _allMarketsCacheTime = 0;
let _allMarketsFetching: Promise<UnifiedMarket[]> | null = null;
const ALL_MARKETS_CACHE_TTL = 30_000; // 30 seconds

export async function fetchAllMarkets(limit: number = 10000): Promise<UnifiedMarket[]> {
  const now = Date.now();

  // 1) Return cached data if fresh
  if (_allMarketsCache && (now - _allMarketsCacheTime) < ALL_MARKETS_CACHE_TTL) {
    console.log(`[AllMarkets] ✅ Cache hit (${Math.round((now - _allMarketsCacheTime) / 1000)}s old, ${_allMarketsCache.length} markets)`);
    return limit < _allMarketsCache.length ? _allMarketsCache.slice(0, limit) : _allMarketsCache;
  }

  // 2) If another request is already fetching, wait for it (dedup)
  if (_allMarketsFetching) {
    console.log(`[AllMarkets] ⏳ Waiting for in-flight fetch...`);
    const result = await _allMarketsFetching;
    return limit < result.length ? result.slice(0, limit) : result;
  }

  // 3) Fetch fresh data
  _allMarketsFetching = (async () => {
    try {
      console.log(`[AllMarkets] 🔄 Fetching fresh data...`);
      const startTime = Date.now();

      const [polymarketData, kalshiData] = await Promise.allSettled([
        fetchPolymarketMarkets(limit),
        fetchKalshiMarkets(limit < 100 ? 200 : 5000), // Small limit = small Kalshi fetch
      ]);

      const polymarkets = polymarketData.status === 'fulfilled' ? polymarketData.value : [];
      const kalshiMarkets = kalshiData.status === 'fulfilled' ? kalshiData.value : [];

      if (polymarketData.status === 'rejected') {
        console.error(`[AllMarkets] Polymarket fetch failed:`, polymarketData.reason);
      }
      if (kalshiData.status === 'rejected') {
        console.error(`[AllMarkets] Kalshi fetch failed:`, kalshiData.reason);
      }

      const merged = [...polymarkets, ...kalshiMarkets];
      merged.sort((a, b) => b.volume - a.volume);

      const fetchTime = Date.now() - startTime;
      console.log(`[AllMarkets] ✅ Fetched ${merged.length} markets in ${fetchTime}ms (Poly: ${polymarkets.length}, Kalshi: ${kalshiMarkets.length})`);

      // Update cache
      _allMarketsCache = merged;
      _allMarketsCacheTime = Date.now();

      return merged;
    } finally {
      _allMarketsFetching = null;
    }
  })();

  const result = await _allMarketsFetching;
  return limit < result.length ? result.slice(0, limit) : result;
}

// ============================================================================
// FAST CRYPTO MARKETS FETCHER
// Fetches crypto markets resolving within the next ~60 minutes from both
// Polymarket and Kalshi. Tagged as category: 'Fast Markets'.
// ============================================================================

export async function fetchFastCryptoMarkets(): Promise<UnifiedMarket[]> {
  const nowMs = Date.now();
  const cutoffMs = nowMs + 60 * 60 * 1000; // 1-hour window
  const markets: UnifiedMarket[] = [];

  // ── 1. Polymarket fast markets ──────────────────────────────────────────
  try {
    const res = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&closed=false&order=endDate&ascending=true&limit=200',
      { cache: 'no-store' },
    );
    if (res.ok) {
      const raw = await res.json();
      const list: any[] = Array.isArray(raw) ? raw : (raw.data || raw.markets || []);
      for (const m of list) {
        const endMs = new Date(m.endDate || m.end_date || 0).getTime();
        if (endMs <= nowMs || endMs > cutoffMs) continue;

        const question = (m.question || m.title || '').toLowerCase();
        const tags = ((m.tags || []) as any[])
          .map((t: any) => (t.slug || t.label || String(t)).toLowerCase())
          .join(' ');
        const isCrypto =
          question.includes('btc') || question.includes('bitcoin') ||
          question.includes('eth') || question.includes('ethereum') ||
          question.includes('sol') || question.includes('solana') ||
          question.includes('crypto') || question.includes('coin') ||
          question.includes('doge') || question.includes('xrp') ||
          tags.includes('crypto') || tags.includes('bitcoin');
        if (!isCrypto) continue;

        const price = Math.max(0.01, Math.min(0.99, parseFloat(m.lastTradePrice || m.bestBid || '0.5') || 0.5));
        const minsLeft = Math.round((endMs - nowMs) / 60_000);

        markets.push({
          id: m.conditionId || String(m.id || ''),
          conditionId: m.conditionId || String(m.id || ''),
          provider: 'Polymarket',
          name: m.question || m.title || 'Unknown',
          eventTitle: m.question || m.title || 'Unknown',
          description: `Resolves in ~${minsLeft} min`,
          price,
          outcomes: [
            { id: `${m.conditionId}-yes`, name: 'Yes', price },
            { id: `${m.conditionId}-no`, name: 'No', price: 1 - price },
          ],
          imageUrl: m.image || m.icon || '',
          polymarketUrl: m.slug ? `https://polymarket.com/event/${m.slug}` : 'https://polymarket.com',
          kalshiUrl: '',
          slug: m.slug || String(m.conditionId || m.id || ''),
          volume: parseInt(String(m.volume || '0'), 10),
          volumeFormatted: formatVolume(parseInt(String(m.volume || '0'), 10)),
          category: 'Fast Markets',
          last_updated: new Date().toISOString(),
          resolutionDate: m.endDate || m.end_date || '',
          change: parseFloat(String(m.oneDayPriceChange || '0')) || 0,
        });
      }
    }
  } catch (err) {
    console.warn('[FastMarkets] Polymarket error:', err);
  }

  // ── 2. Kalshi fast crypto markets ───────────────────────────────────────
  try {
    const accessKey = process.env.KALSHI_ACCESS_KEY;
    const privateKey = process.env.KALSHI_PRIVATE_KEY;
    if (accessKey && privateKey) {
      const { generateKalshiHeaders } = await import('./kalshi-auth');
      const HOST = 'https://api.elections.kalshi.com';
      const path = '/trade-api/v2/events';
      const params = new URLSearchParams({ status: 'open', limit: '200', with_nested_markets: 'true' });
      const authHeaders = generateKalshiHeaders('GET', path, accessKey, privateKey);

      const res = await fetch(`${HOST}${path}?${params}`, {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...authHeaders },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const FAST_PREFIXES = ['KXBTC', 'KXETH', 'KXSOL', 'KXDOGE', 'KXXBT', 'KXAVAX', 'KXLINK', 'KXBNB', 'KXDOT', 'KXXRP'];
        for (const event of (data.events || []) as any[]) {
          const ticker = (event.event_ticker || '').toUpperCase();
          if (!FAST_PREFIXES.some(p => ticker.startsWith(p))) continue;

          const nested: any[] = event.markets || [];
          const first = nested[0];
          if (!first) continue;

          const closeMs = new Date(first.close_time || first.expected_expiration_time || 0).getTime();
          if (closeMs <= nowMs || closeMs > cutoffMs) continue;

          const minsLeft = Math.round((closeMs - nowMs) / 60_000);
          const seriesTicker = event.series_ticker || '';
          const kalshiSlug = seriesTicker
            ? `${seriesTicker.toLowerCase()}/${event.event_ticker.toLowerCase()}`
            : event.event_ticker.toLowerCase();
          const imageUrl = seriesTicker
            ? `https://kalshi-public-docs.s3.amazonaws.com/series-images-webp/${seriesTicker}.webp`
            : '';

          const outcomes = nested.map((m: any, idx: number) => {
            let p = m.last_price != null && m.last_price > 0 ? m.last_price / 100
              : m.yes_bid != null ? m.yes_bid / 100
              : m.yes_ask != null ? m.yes_ask / 100 : 0.5;
            p = Math.max(0.01, Math.min(0.99, p));
            const name = (m.subtitle || m.yes_sub_title || m.title || '')
              .replace(/^::\s*/g, '').replace(/^--\s*/g, '').trim() || `Option ${idx + 1}`;
            return { id: m.ticker || `${event.event_ticker}-${idx}`, name, price: p };
          });

          const primaryPrice = outcomes.length > 0
            ? Math.max(...outcomes.map((o: any) => o.price))
            : 0.5;
          const totalVol = nested.reduce((s: number, m: any) => s + (m.volume || 0), 0);

          markets.push({
            id: `kalshi-fast-${event.event_ticker}`,
            conditionId: event.event_ticker,
            provider: 'Kalshi',
            name: event.title || event.event_ticker,
            eventTitle: event.title || event.event_ticker,
            description: `Resolves in ~${minsLeft} min`,
            price: primaryPrice,
            outcomes,
            imageUrl,
            polymarketUrl: `https://kalshi.com/markets/${kalshiSlug}`,
            kalshiUrl: `https://kalshi.com/markets/${kalshiSlug}`,
            slug: event.event_ticker.toLowerCase(),
            volume: totalVol,
            volumeFormatted: formatVolume(totalVol),
            category: 'Fast Markets',
            last_updated: new Date().toISOString(),
            resolutionDate: first.close_time || first.expected_expiration_time || '',
            change: 0,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[FastMarkets] Kalshi error:', err);
  }

  // Sort soonest-resolving first
  markets.sort((a, b) => {
    const at = a.resolutionDate ? new Date(a.resolutionDate).getTime() : 0;
    const bt = b.resolutionDate ? new Date(b.resolutionDate).getTime() : 0;
    return at - bt;
  });

  console.log(`[FastMarkets] ${markets.length} fast crypto markets found (within 1h)`);
  return markets;
}