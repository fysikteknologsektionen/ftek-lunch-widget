<?php
/*
Plugin Name: Ftek Lunch Widget
Description: A widget showing the lunches at Chalmers University
Author: Anton Älgmyr
Text Domain: chlw
Domain Path: /languages
GitHub Plugin URI: Fysikteknologsektionen/ftek-lunch-widget
 */

add_action( 'init', 'init_chlw' );
function init_chlw() {
  // Load translations
  load_plugin_textdomain('chlw', false, basename( dirname( __FILE__ ) ) . '/languages' );
}


function chlw_format_dish($dish, $lang) {
  $inEnglish = $lang != "sv";

  $css = 'style="height:1.2em;width:auto;margin:1pt;margin-left:4pt;vertical-align:middle"';

  $dishStr = $dish->displayNames[$inEnglish]->displayName;
  $dishStr = $dishStr . "<span style='white-space:nowrap;'>";
  foreach ($dish->allergens as $allergen) {
    $imageUrl = str_replace("http://", "https://", $allergen->imageURLDark);
    $dishStr = $dishStr . " <img src=\"" . $imageUrl . "\" " . $css . "/>";
  }
  $dishStr = $dishStr . "</span>";

  return $dishStr;
}

function chlw_get_restaurants() {
  return array(
    "Express" => 7,
    "Kårrestaurangen" => 5,
    /*"L's Kitchen" => 8,
    //"L's Express" => 9,
    "L's Resto" => 32,
    "Linsen" => 33,
    "Hyllan" => 34,
    "Kokboken" => 35,
    "S.M.A.K" => 42,*/
    );
}

function chlw_get_json_menu() {
  $all_restaurants = chlw_get_restaurants();
  $allMenus = array();
  foreach ($all_restaurants as $restaurant) {
    $url = "http://carboncloudrestaurantapi.azurewebsites.net/api/menuscreen/getdataweek?restaurantid=$restaurant";
    $json = file_get_contents($url);
    $allMenus[$restaurant] = json_decode($json);
  }
  return $allMenus;
}

function chlw_get_menu($restName, $lang) {

  $restId = chlw_get_restaurants()[$restName];

  $url = "http://carboncloudrestaurantapi.azurewebsites.net/api/menuscreen/getdataday?restaurantid=$restId";
  $json = file_get_contents($url);
  $dayMenu = json_decode($json);

  // For every category, make a list of dishes
  $menu = array();
  if (isset($dayMenu->recipeCategories)) {
     foreach ($dayMenu->recipeCategories as $cat) {
       $catName = $lang == "sv" ? $cat->name : $cat->nameEnglish;

       $menu[$catName] = array_map(
           function($dish) use ($lang) {
             return chlw_format_dish($dish, $lang);
           },
           $cat->recipes);
     }
  }

  return $menu;
}

/*
 *  Widget
 */
class ChalmersLunchWidget extends WP_Widget {

  function __construct() {
    // Instantiate the parent object
    parent::__construct(
        'ftek_lunch_widget', 
        __('Chalmers Lunch Widget', 'chlw'),
        array( 
          'description' => __('Shows lunch menus for Chalmers University', 'chlw'),
          'classname' => 'ftek_lunch_widget',
          )
        );
  }

  function widget( $args, $instance ) {
    // Default Settings
    $all_restaurants = chlw_get_restaurants();
    $restaurants = array(
      'Kårrestaurangen',
      'Express',
    );
    $lang = qtrans_getLanguage();
    $lunch_data = array(
      'restaurants' => $all_restaurants,
      'localizedStrings' => array(
        'noLunch' => __('No lunch today','chlw'),
        'tomorrowsLunch' => __("Tomorrow's lunch","chlw"),
      ),
      'allMenus' => chlw_get_json_menu(),
    );
    wp_enqueue_style('ftek-lunch-widget-style', plugin_dir_url( __FILE__ ) .'css/ftek-lunch-widget.css', null, null, 'all' );
    wp_enqueue_script('ftek-lunch-widget-script', plugin_dir_url( __FILE__ ) .'js/ftek-lunch-widget.js', array( 'jquery' ), null, true );
    wp_localize_script( 'ftek-lunch-widget-script', 'lunchData', $lunch_data );
    
    $title = __("Today's lunch", 'chlw');

    // Some WP fluff
    echo $args['before_widget'];
    $title = apply_filters( 'widget_title', $title);
    echo $args['before_title'] . '<a href="https://chalmerskonferens.se/lunchmenyer-johanneberg/">' . $title .'</a>'. $args['after_title'];
    
    echo '<div id="lunch-menu-control">';
    echo '<label id="lunch-menu-button-label" for="lunch-menu-button"><img src="'.plugin_dir_url( __FILE__ ) .'images/spoon-fork.svg" /></label><input id="lunch-menu-button" type="checkbox" />';
    echo '<menu id="lunch-menu-restaurants">';
    foreach ($all_restaurants as $restName => $restID) {
      echo '<li><label>'.$restName.'<input id="rest-'.$restID.'" type="checkbox" value="'.$restID.'" /></label></li>';
    }
    echo '</menu></div>';
    echo '<div id="lunch-menu">'.__('Please enable Javascript.','chlw').'</div>';
    echo '<div id="placeholder">';
    // Get all menus
    foreach ($restaurants as $restName) {
      // Get formatted dishes for all categories for the restaurant 
      $menu = chlw_get_menu($restName, $lang);

      ksort($menu, SORT_STRING);

      echo "<h3 class='lunch-place'>$restName</h3>";

      if ($menu == NULL) {
        echo __("No lunch today", 'chlw');
        continue;
      }

      echo "<ul class='meals'>";
      foreach ($menu as $cat => $dishes) {
        echo "<li class='meal'>";
        echo "<span class='meal-title'>$cat</span>";
        echo "<ul>";

        foreach ($dishes as $dish) {
          echo "<li class='dish'>$dish</li>";
        }
        echo "</ul>";
        echo "</li>";
      }
      echo "</ul>";
    }
    echo '</div>';
    echo $args['after_widget'];
  }

  function update( $new_instance, $old_instance ) {
    // Save widget options
    // Todo: add settings for what restaurants to display
  }

  function form( $instance ) {
    // Output admin widget options form
  }
}

function register_ftek_lunch_widget() {
  register_widget( 'ChalmersLunchWidget' );
}

add_action( 'widgets_init', 'register_ftek_lunch_widget' );
