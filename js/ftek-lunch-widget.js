function getCookieValue(a) {
    var b = document.cookie.match('(^|;)\\s*' + a + '\\s*=\\s*([^;]+)');
    return b ? b.pop() : '';
}

function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

function setupLunchMenu(lunchData) {
    
    window.allMenus = {};
    window.selectedWeekDayIndex = 0;
    window.selectedRestaurants = [5, 7];
    let restaurants = getCookieValue('ftek-lunch-restaurants');
    if (restaurants) {
        selectedRestaurants = restaurants.split(',');
        selectedRestaurants = selectedRestaurants.map(function(x){return parseInt(x);});
    }
    
    jQuery('#lunch-menu-restaurants li input').each(function(){
        if (selectedRestaurants.includes(parseInt(jQuery(this).val()))) {
            jQuery(this).prop( "checked", true );
        }
    });
    
    jQuery('#lunch-menu-restaurants li input').change(function(){
        let restID = parseInt(jQuery(this).val());
        if (this.checked) {
            if (!selectedRestaurants.includes(restID)) {
                selectedRestaurants.push(restID);
            }
        } else {
            if (selectedRestaurants.includes(restID)) {
                selectedRestaurants.splice(selectedRestaurants.indexOf(restID), 1);
            }
        }
        setCookie('ftek-lunch-restaurants', selectedRestaurants, 365);
        printLunchMenu();
    });
}

function fetchLunchMenu(lunchData) {
    
    let requests = Object.values(lunchData.restaurants).map(function(restaurantId){
        /*return fetch('http://carboncloudrestaurantapi.azurewebsites.net/api/menuscreen/getdataweek?restaurantid='+restaurantId)
        .then(function(response) {
            return response.json();
        }); */
        return lunchData.allMenus[restaurantId];
    });
    Promise.all(requests).then(function(allMenus){
        allMenus = allMenus.map(function(menu){return parseLunchMenu(menu)});
        allMenus = orderLunchMenu(allMenus);
        window.allMenus = allMenus;
        printLunchMenu();
    });
    
}

function printLunchMenu() {
    menu = allMenus[selectedWeekDayIndex];
    if (!menu) {
        jQuery("#lunch-menu").removeClass('spinner').html('<h2>'+lunchData.localizedStrings.noLunch+'</h2>');
        return;
    }
    let html = '';
    menu.map(function(restMenu, i){
        if (selectedRestaurants.includes(Object.values(lunchData.restaurants)[i]) && restMenu) {
            html += '<h2>' + Object.keys(lunchData.restaurants)[i] + '</h2>';
            html += '<dl>';
            restMenu.map(function(dish){
                html += '<dt>'+dish.name+'</dt>';
                dish.recipes.map(function(recipe){
                    html += '<dd class="lunch-menu-dish">'+recipe.dish;
                    if (recipe.allergens[0]) {
                        let allergens = recipe.allergens.map(function(url){
                            let title = url.split('/').slice(-1)[0].split('.')[0];
                            title = title.charAt(0).toUpperCase() + title.slice(1);
                            return '<img src="'+url+'" alt="'+title+'" title="'+title+'" />';
                        }).join('');
                        html += allergens;
                    }
                    html += '</dd>';
                    html += '<dd class="lunch-menu-price">'+recipe.price+' kr</dd>';
                    if (parseFloat(recipe.CO2) > 0) {
                        html += '<dd class="lunch-menu-co2" title="'+recipe.CO2+' kg CO2-eq" data-co2="'+recipe.CO2+'">'+recipe.CO2+' <span>kg CO2-eq</span></dd>';
                    } else {
                        html += '<dd class="lunch-menu-co2" style="height:1px;visibility:hidden;margin:0;"></dd>';
                    }
                });
            });
            html += '</dl>';
        }
    });
    jQuery("#lunch-menu").removeClass('spinner').html(html);
    setTimeout(function(){
        jQuery(".lunch-menu-co2").each(function(){
            let percent = parseFloat(jQuery(this).attr('data-co2'))*25; // 4 kg = 100%
            percent = Math.min(...[percent, 100]);
            jQuery(this).css('width', percent+'%');
            let hue = Math.max([120-percent*1.2], 0);
            jQuery(this).css('background-color', 'hsl('+hue+', 100%, 28%)');
        });
    }, 1);
}

function orderLunchMenu(allMenus) {
    let allMenusNew = [];
    for (let i = 0; i < allMenus[0].length; i++) {
        allMenusNew.push(allMenus.map(function(menu){return menu[i]})); 
    }
    return allMenusNew;
}

function parseLunchMenu(json) {
    let menus = json.menus;;
    if (menus.length === 0) {
        return false;
    }
    // Only show today and forward
    menus = menus.filter(function(menuDay){
        return ((new Date(menuDay.menuDate)).getDay()+6)%7 >= ((new Date()).getDay()+6)%7;
    });
    let nameKey = ['name', 'nameEnglish'][+(ftek_info.language === 'en-US')];
    menus = menus.map(function(menu) {
        return menu.recipeCategories.map(function(menuCat){
            return {
                name: menuCat[nameKey],
                recipes: menuCat.recipes.map(function(recipe) {
                    return {
                        dish: recipe.displayNames[+(ftek_info.language === 'en-US')].displayName,
                        CO2: recipe.cO2e,
                        allergens : recipe.allergens.map(function(allergy){
                            if (allergy.imageURLDark) {
                                return allergy.imageURLDark.replace(/http/g,'https');
                            } else {
                                return null;
                            }
                        }),
                        price: recipe.priceStudentUnion,};
                    }),
                };
            });
        }
    );
    return menus;
}

jQuery('.ftek_lunch_widget #lunch-menu').text('').addClass('spinner');
jQuery('.ftek_lunch_widget #placeholder').hide();

setupLunchMenu(lunchData);
fetchLunchMenu(lunchData);