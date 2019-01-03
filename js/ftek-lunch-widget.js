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
    
    window.allMenus = null;
    window.selectedRestaurants = ['3d519481-1667-4cad-d2a3-08d558129279','21f31565-5c2b-4b47-d2a1-08d558129279'];
    window.selectedDate = (new Date());
    if (selectedDate.getHours() > 15) {
        selectedDate.setDate(selectedDate.getDate() + 1);
    }
    let restaurants = getCookieValue('ftek-lunch-restaurants');
    if (restaurants) {
        selectedRestaurants = restaurants.split(',');
    }
    
    jQuery('#lunch-menu-restaurants li input').each(function(){
        if (selectedRestaurants.includes(this.value)) {
            this.checked = true;
        }
    });
    
    jQuery('#lunch-menu-restaurants li input').change(function(){
        let restID = this.value;
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
        fetchLunchMenu(lunchData, selectedDate)
    });
}

function fetchLunchMenu(lunchData, date) {
    dateStr = date.toISOString().substr(0,10);
    let requests = Object.values(selectedRestaurants).map(function(restaurantId){
        return fetch('https://carbonateapiprod.azurewebsites.net/api/v1/mealprovidingunits/'+restaurantId+'/dishoccurrences?startDate='+dateStr+'&endDate='+dateStr)
        .then(function(response) {
            return response.json();
        });
        //return lunchData.allMenus[restaurantId];
    });
    Promise.all(requests).then(function(allMenus){
        console.log(allMenus);
        /*
        allMenus = allMenus.map(function(menu){return parseLunchMenu(menu)});
        allMenus = orderLunchMenu(allMenus);
        window.allMenus = allMenus;
        */
       printLunchMenu(lunchData);
    });
    
}

function printLunchMenu(lunchData) {
    menu = allMenus;
    if (!menu) {
        jQuery("#lunch-menu").removeClass('spinner').html('<h2>'+lunchData.localizedStrings.noLunch+'</h2><p>'+selectedDate+'</p>');
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
fetchLunchMenu(lunchData, (new Date()));