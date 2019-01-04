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

function setupLunchMenu() {
    
    lunchData.selectedRestaurants = ['3d519481-1667-4cad-d2a3-08d558129279','21f31565-5c2b-4b47-d2a1-08d558129279'];
    lunchData.selectedDate = (new Date());
    if (lunchData.selectedDate.getHours() > 15) {
        lunchData.selectedDate.setDate(lunchData.selectedDate.getDate() + 1);
    }
    document.getElementById('lunch-menu-day').children[1].textContent = lunchData.selectedDate.toLocaleDateString(ftek_info.language, { weekday: 'long', day: 'numeric', month: 'numeric' });
    let restaurants = getCookieValue('ftek-lunch-restaurants');
    if (restaurants) {
        selectedRestaurants = restaurants.split(',');
        lunchData.selectedRestaurants = selectedRestaurants.filter(function(rest) {
            return Object.values(lunchData.restaurants).includes(rest);
        });
        setCookie('ftek-lunch-restaurants', lunchData.selectedRestaurants, 365);
    }
    
    lunchData.selectedRestaurants.forEach(function(restID) {
        document.getElementById('rest-'+restID).checked = true;
    });
    
    jQuery('#lunch-menu-restaurants li input').change(function(){
        let restID = this.value;
        if (this.checked) {
            if (!lunchData.selectedRestaurants.includes(restID)) {
                lunchData.selectedRestaurants.push(restID);
            }
        } else {
            if (lunchData.selectedRestaurants.includes(restID)) {
                lunchData.selectedRestaurants.splice(lunchData.selectedRestaurants.indexOf(restID), 1);
            }
        }
        setCookie('ftek-lunch-restaurants', lunchData.selectedRestaurants, 365);
        fetchLunchMenu()
    });

    jQuery('#lunch-menu-day > button').click(function(){
        let dateChange = (this.getAttribute('data-action')==='next'?1:-1);
        lunchData.selectedDate.setDate(lunchData.selectedDate.getDate() + dateChange);
        this.parentElement.children[1].textContent = lunchData.selectedDate.toLocaleDateString(ftek_info.language, { weekday: 'long', day: 'numeric', month: 'numeric' });
        fetchLunchMenu()
    });
}

function fetchLunchMenu() {
    jQuery('.ftek_lunch_widget #lunch-menu').text('').addClass('spinner');

    dateStr = lunchData.selectedDate.toISOString().substr(0,10);
    selectedRestaurantsOrdered = Object.values(lunchData.restaurants).filter(function(rest) {
        return lunchData.selectedRestaurants.includes(rest);
    });
    let requests = selectedRestaurantsOrdered.map(function(restID){
        return fetch('https://carbonateapiprod.azurewebsites.net/api/v1/mealprovidingunits/'+restID+'/dishoccurrences?startDate='+dateStr+'&endDate='+dateStr)
        .then(function(response) {
            return response.json();
        }).then(function(json){
            return parseLunchMenu(json);
        });
    });
    Promise.all(requests).then(function(allMenus){
        lunchData.allMenus = allMenus;
        printLunchMenu();
    }).catch(function(e){
        jQuery("#lunch-menu").removeClass('spinner').html('<h2>Could not load.</h2>');
    });
    
}

function printLunchMenu() {
    if (lunchData.allMenus.length === 0) {
        jQuery("#lunch-menu").removeClass('spinner').html('<h2>'+lunchData.localizedStrings.noLunch+'</h2>');
        return;
    }
    let html = '';
    lunchData.allMenus.map(function(restMenu, i){
        if (!restMenu || restMenu.dishes.filter(function(dish){return dish.recipes.length>0}).length === 0) return;

        html += '<h2>' + restMenu.restaurantName + '</h2>';
        html += '<dl>';
        restMenu.dishes.map(function(dish){
            if (dish.recipes.length > 0) {
                html += '<dt>'+dish.name+'</dt>';
                dish.recipes.map(function(recipe){
                    html += '<dd class="lunch-menu-dish">'+recipe.dish;
                    if (recipe.allergens.length > 0) {
                        let allergens = recipe.allergens.map(function(allergy){
                            return '<img src="'+allergy.imageURL+'" alt="'+allergy.name+'" title="'+allergy.name+'" />';
                        }).join('');
                        html += allergens;
                    }
                    html += '</dd>';
                    if (recipe.price > 0) {
                        html += '<dd class="lunch-menu-price">'+recipe.price+' kr</dd>';
                    }
                    if (recipe.CO2 > 0) {
                        html += '<dd class="lunch-menu-co2" title="'+recipe.CO2+' kg CO2-eq" data-co2="'+recipe.CO2+'">'+recipe.CO2+' <span>kg CO2-eq</span></dd>';
                    } else {
                        html += '<dd class="lunch-menu-co2" style="height:1px;visibility:hidden;margin:0;"></dd>';
                    }
                });
            }
        });
        html += '</dl>';
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

function parseLunchMenu(json) {
    if (json.length === 0) {
        return null;
    }
    let lang = +(ftek_info.language === 'en-US');
    let nameKey = ['dishTypeName','dishTypeNameEnglish'][lang];
    let displayNameCategoryName = ['Swedish','English'][lang];
    menus = {
        restaurantName: json[0].mealProvidingUnit.mealProvidingUnitName,
        restID: json[0].mealProvidingUnitID,
        dishes: json[0].availableDishTypes.map(function(dishType) {
            return {
                name: dishType[nameKey],
                recipes: json.filter(function(dish){return dish.dishTypeID === dishType.id;}).map(function(recipe){
                    return {
                        dish: recipe.displayNames.filter(function(displayName){
                            return displayName.displayNameCategory.displayNameCategoryName===displayNameCategoryName
                        })[0].dishDisplayName,
                        CO2: Math.round(recipe.dish.totalEmission*100)/100,
                        allergens: recipe.dish.recipes[0].allergens.map(function(allergy){
                            return {
                                name: allergy.allergenCode.charAt(0).toUpperCase() + allergy.allergenCode.slice(1),
                                imageURL: allergy.allergenURL,
                            }
                        }),
                        price: recipe.dish.price,
                    }
                }),
            };
        })
    }

    return menus;
}

setupLunchMenu();
fetchLunchMenu();