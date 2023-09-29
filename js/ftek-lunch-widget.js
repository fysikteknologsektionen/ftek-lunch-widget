function getCookieValue(a) {
    // Cookies are used to save your selection of restaurants
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

function getMondayOfWeek(d) {
    // Not used in current version
    d = new Date(d);
    var day = d.getDay(),
    diff = d.getDate() - day + (day == 0 ? -6:1);
    return new Date(d.setDate(diff));
}

function sameDate(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function setupLunchMenu() {
    
    lunchData.selectedRestaurants = ['21f31565-5c2b-4b47-d2a1-08d558129279'];
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
    let selected_day = lunchData.selectedDate.toLocaleDateString('sv-SE')
    selectedRestaurantsOrdered = Object.values(lunchData.restaurants).filter(function(rest) {
        return lunchData.selectedRestaurants.includes(rest);
    });
    let requests = selectedRestaurantsOrdered.map(function(restID){
        return fetch('https://plateimpact-heimdall.azurewebsites.net/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: '{"query": "query DishOccurrencesByTimeRangeQuery($mealProvidingUnitID: String = \\"'+restID+'\\", $startDate: String = \\"'+selected_day+'\\", $endDate: String = \\"'+selected_day+'\\") {dishOccurrencesByTimeRange(mealProvidingUnitID: $mealProvidingUnitID, startDate: $startDate, endDate: $endDate) {...MenuDishOccurrence}} fragment MenuDishOccurrence on DishOccurrence {displayNames {name categoryName} startDate dishType {name} dish {name}}"}'
        })
        .then(function(response) {
            return response.json();
        }).then(function(json){
            json.restID = restID;
            json.restaurantName = document.getElementById('rest-' + restID).parentElement.textContent;
            return parseLunchMenu(json);
        });
    });
    Promise.all(requests).then(function(allMenus){
        lunchData.allMenus = allMenus;
        printLunchMenu();
    }).catch(function(e){
        console.log(e)
        jQuery("#lunch-menu").removeClass('spinner').html('<h2>Could not load.</h2>');
    });
    
}

function printLunchMenu() {
    if (lunchData.allMenus.length === 0 || lunchData.allMenus.every(e => e === null) || lunchData.allMenus.every(e => e.dishes.every(e=>e.recipes.length === 0))) {
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
                html += '<dd class="lunch-menu-dish">'+dish.recipes
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
    let is_en = +(ftek_info.language === 'en-US');
    let lang = ['Swedish','English'][is_en];
    let menu = {
        restaurantName: json.restaurantName,
        restID: json.restID,
        dishes: json.data.dishOccurrencesByTimeRange.map(function (dishType) {
            return {
                name: dishType.dishType.name,
                recipes: dishType.displayNames.filter(function (name) {
                    if (name.categoryName === lang) {
                        return name.name
                    }
                })[0].name
            };
        })
    };
    return menu;
}

setupLunchMenu();
fetchLunchMenu();