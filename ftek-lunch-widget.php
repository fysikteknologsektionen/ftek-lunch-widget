<?php
/*
Plugin Name: Ftek Lunch Widget
Description: A widget showing the lunches at Chalmers University
Author: Johan Winther
Version: 1.1.1
Text Domain: chlw
Domain Path: /languages
GitHub Plugin URI: Fysikteknologsektionen/ftek-lunch-widget
 */

add_action( 'init', 'init_chlw' );
function init_chlw() {
  // Load translations
  load_plugin_textdomain('chlw', false, basename( dirname( __FILE__ ) ) . '/languages' );
}

function chlw_get_restaurants() {
  return array(
    "Express" => '3d519481-1667-4cad-d2a3-08d558129279',
    "Kårrestaurangen" => '21f31565-5c2b-4b47-d2a1-08d558129279',
    "Linsen" => 'b672efaf-032a-4bb8-d2a5-08d558129279',
    "Hyllan" => 'a7f0f75b-c1cb-4fc3-d2a6-08d558129279',
    "S.M.A.K" => '3ac68e11-bcee-425e-d2a8-08d558129279',
    "L's Express" => '871c63d7-4ddb-46b8-d2a0-08d558129279',
    "L's Kitchen" => 'c74da2cf-aa1a-4d3a-9ba6-08d5569587a1',
    "L's Resto" => 'c6742862-3cc5-47b1-d2a4-08d558129279',
    "Kokboken" => '4dce0df9-c6e7-46cf-d2a7-08d558129279',
    );
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
    $lang = qtrans_getLanguage();
    $lunch_data = array(
      'restaurants' => $all_restaurants,
      'localizedStrings' => array(
        'noLunch' => __('No lunch today','chlw'),
        'tomorrowsLunch' => __("Tomorrow's lunch","chlw"),
      ),
    );
    wp_enqueue_style('ftek-lunch-widget-style', plugin_dir_url( __FILE__ ) .'css/ftek-lunch-widget.css', null, null, 'all' );
    wp_enqueue_script('ftek-lunch-widget-script', plugin_dir_url( __FILE__ ) .'js/ftek-lunch-widget.js', array( 'jquery' ), null, true );
    wp_localize_script( 'ftek-lunch-widget-script', 'lunchData', $lunch_data );
    
    $title = "Lunch";

    // Some WP fluff
    echo $args['before_widget'];
    $title = apply_filters( 'widget_title', $title);
    echo $args['before_title'] . '<a href="https://chalmerskonferens.se/lunchmenyer-johanneberg/" target="_blank" class="no-external">' . $title .'</a>'. $args['after_title'];
    
    echo '<div id="lunch-menu-day">';
    echo '<button class="button" data-action="prev">&laquo;</button>';
    echo '<span></span>';
    echo '<button class="button" data-action="next">&raquo;</button>';
    echo '<div id="lunch-menu-control">';
    echo '<label id="lunch-menu-button-label" for="lunch-menu-button"><img src="'.plugin_dir_url( __FILE__ ) .'images/spoon-fork.svg" /></label><input id="lunch-menu-button" type="checkbox" />';
    echo '<menu id="lunch-menu-restaurants">';
    foreach ($all_restaurants as $restName => $restID) {
      echo '<li><label>'.$restName.'<input id="rest-'.$restID.'" type="checkbox" value="'.$restID.'" /></label></li>';
    }
    echo '</menu></div>';
    echo '</div>';
    echo '<div id="lunch-menu">'.__('Please enable Javascript.','chlw').'</div>';

    echo $args['after_widget'];
  }

  function update( $new_instance, $old_instance ) {
    // Save widget options
    // No widget options are currently planned
  }

  function form( $instance ) {
    // Output admin widget options form
  }
}

function register_ftek_lunch_widget() {
  register_widget( 'ChalmersLunchWidget' );
}

add_action( 'widgets_init', 'register_ftek_lunch_widget' );
