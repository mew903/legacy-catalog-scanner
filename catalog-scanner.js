/*
	Author: mew903
	
	DISCLAIMER: 
	+	The following code is released for educational purposes only.
	+	Item botting is a grey area in terms of Roblox's Terms of Service agreement and should not be performed under any circumstance.
	
	Licensed under the Academic Free License version 3.0
  See license.txt for more information on how to use this software
*/

// item asset id blacklist
var blacklist = { 
	'00000000': true,
	// '<Item Asset Id>': true,
};

// max price of any items to buy
var maxPrice = 700;

 // # of catalog pages to scan
var pages = 7;

/* script init point */
var rapCache = { };
var totalProfit = 0;

// please note that api calls in this function may be outdated
function buyItem(bestPrice, itemId, name, cursor) {
    $.get('https://www.roblox.com/catalog/' + itemId, function(data) {
        var info = $(data).find('#item-container').data();
        var sellerId = info.expectedSellerId;

        if (expectedPrice == bestPrice) {
            console.log('// Found: ' + name + ' for ' + bestPrice);
			console.group();

            $.getJSON('https://inventory.roblox.com/v1/users/' + sellerId + '/assets/collectibles?assetType=' + info.assetType + '&sortOrder=Asc&limit=100&cursor=' + cursor, function(uaidData) {
                var userassetId = [ ];

                $(uaidData.data).each(function(index) {
                    if (uaidData.data[index].assetId == itemId) {
                        userassetId.push(uaidData.data[index].userAssetId);
                    }
                });

                if (userassetId.length > 0) {
                    $(userassetId).each(function(uaId) {
                        $.post("https://www.roblox.com/API/Item.ashx?rqtype=purchase&productID=" + info.productId + "&expectedCurrency=1&expectedPrice=" + info.expectedPrice + "&expectedSellerID=" + sellerId + "&userAssetID=" + userassetId[uaId], function() {
                            console.log('// Bought: ' + name + ' for ' + bestPrice);
							
							setTimeout(function() {
								$.getJSON('https://economy.roblox.com/v1/assets/' + itemId + '/resale-data', function(rapData) {
									if (rapData.recentAveragePrice != null) {
										var avgRap = rapData.recentAveragePrice;
										var salePrice = Math.floor(avgRap + (avgRap * 0.04));
                                        var profit = Math.floor((salePrice * 0.7) - bestPrice);

                                        rapCache[itemId] = avgRap;
                                        totalProfit += profit;

										$.ajax({
                                            method: 'PATCH',
                                            url: 'https://economy.roblox.com/v1/assets/' + itemId + '/resellable-copies/' + uaId,
                                            data: {
                                                price: salePrice
                                            }
										}).success(function() {
											var dateTime = new Date();
											
                                            console.log('// [' + dateTime.getHours() + ':' + dateTime.getMinutes() + '] Put on sale: ' + name + ' for ' + salePrice + ' (RAP: ' + avgRap + ') // Profit expected: ' + profit + ' R$');
                                            console.log('// Total (exp) profit so far: ' + totalProfit);
											console.groupEnd();
                                        }).fail(function() {
											console.warn('// Failed to put item on resale: ' + name);
											console.groupEnd();
										});
									}
								});
							}, 3000);
                        }).fail(function() { 
							console.warn('// Error when buying item: ' + name);
							console.groupEnd();
						});
                    });
                } else {
                    if (uaidData.nextPageCursor != null) {
                        console.warn('// Retrying: ' + name + ' for ' + bestPrice);
                        buyItem(bestPrice, itemId, name, uaidData.nextPageCursor);
                    } else {
                        console.warn('// Missed: ' + name + ' for ' + bestPrice);
						console.groupEnd();
                    }
                }
            });
        }
    });
}

function checkItem(item, id, rap) {
    if (item.BestPrice > 0 && item.BestPrice < (1 + (Number(rap) * 0.55)) && !(blacklist[id]) && item.BestPrice < maxPrice) {
        buyItem(item.BestPrice, id, item.Name, '');
    }
}

var page = 0;
var next_cursor = '';

// please note that api calls here may be outdated and *will* throw 429 errors without some sort of request throttling implemented
function nextScan() {
	page = (page == pages) ? 1 : page + 1;

    $.ajax({ dataType: "json", url: 'https://catalog.roblox.com/v1/search/items/detailsCategory=2&Subcategory=2&CurrencyType=3&pxMax=' + maxPrice + '&Cursor=' + next_cursor}).success(function(page, _, xhr) {
        if (xhr.status != 301) {
            next_cursor = (page == pages) ? '' : page.nextPageCursor;

            $(page.data).each(function(index, itemArray) { 
				$(itemArray).each(function(index, item) {
					
					var id = item.id;
					
					if (rapCache[id] == null) {
						$.getJSON('https://economy.roblox.com/v1/assets/' + id + '/resale-data', function(rapData) {
							if (rapData.recentAveragePrice != null) {
								rapCache[id] = rapData.recentAveragePrice;
								checkItem(item, id, rapCache[id]);
							} else {
								console.warn('// Failed to fetch RAP for item: ' + item.Name);
							}
						});
					} else {
						checkItem(item, id, rapCache[id]);
					}
				}); 
			});
        }

		nextScan();
    }).fail(function() { 
		console.warn('// Failed to fetch catalog. Exiting script'); 
	});
}

console.clear();
nextScan();
