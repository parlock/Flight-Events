import * as React from 'react';
import styled from 'styled-components';
import * as L from 'leaflet';
import 'leaflet-rotatedmarker';
import * as signalr from '@microsoft/signalr';
import { AircraftStatus } from '../Models';
import AircraftList from './AircraftList';
import EventList from './EventList';
import { MAPBOX_API_KEY } from '../Constants';

enum MapTileType {
    OpenStreetMap,
    OpenTopoMap,
    EsriWorld
}

interface State {
    aircrafts: { [connectionId: string]: AircraftStatus };
    myConnectionId: string | null;
    followingConnectionId: string | null;
}

interface Markers {
    aircraft: L.Marker<any>
    info: L.Marker<any>
}

export class Home extends React.Component<any, State> {
    static displayName = Home.name;

    mymap: L.Map;
    baseLayerGroup: L.LayerGroup;
    markers: { [connectionId: string]: Markers } = {}

    constructor(props: any) {
        super(props);

        this.state = {
            aircrafts: {},
            myConnectionId: null,
            followingConnectionId: null
        }

        this.handleAircraftClick = this.handleAircraftClick.bind(this);
        this.handleOpenStreetMap = this.handleOpenStreetMap.bind(this);
        this.handleOpenTopoMap = this.handleOpenTopoMap.bind(this);
        this.handleEsriWorld = this.handleEsriWorld.bind(this);
        this.handleMeChanged = this.handleMeChanged.bind(this);
        this.handleFollowingChanged = this.handleFollowingChanged.bind(this);
    }

    componentDidMount() {
        this.mymap = L.map('mapid').setView([51.505, -0.09], 13);

        this.baseLayerGroup = L.layerGroup().addTo(this.mymap);
        this.setTileLayer(MapTileType.OpenStreetMap);

        let hub = new signalr.HubConnectionBuilder()
            .withUrl('/FlightEventHub')
            .withAutomaticReconnect()
            .build();

        hub.onreconnected(connectionId => {
            console.log('Connected to SignalR with connection ID ' + connectionId);
        })

        hub.on("UpdateAircraft", (connectionId, aircraftStatus: AircraftStatus) => {
            this.setState({
                aircrafts: {
                    ...this.state.aircrafts,
                    [connectionId]: aircraftStatus
                }
            });

            let latlng: L.LatLngExpression = [aircraftStatus.latitude, aircraftStatus.longitude];

            if (Object.keys(this.markers).length === 0) {
                this.mymap.setView(latlng, 11);
            } else if (connectionId === this.state.followingConnectionId) {
                this.mymap.setView(latlng, this.mymap.getZoom());
            }

            let markers = this.markers[connectionId];
            if (markers) {
                markers.aircraft.setLatLng(latlng);
                markers.info.setLatLng(latlng);
            } else {
                const aircraft = L.marker(latlng, {
                    icon: L.icon({
                        iconUrl: 'marker-aircraft.png',
                        iconSize: [10, 30],
                        iconAnchor: [5, 25],
                    })
                }).addTo(this.mymap);
                const info = L.marker(latlng, {
                    icon: L.divIcon({
                        className: 'divicon-aircraft-info',
                        html: `<div>${aircraftStatus.callsign}</div>`,
                        iconAnchor: [-12, -4],
                    })
                }).addTo(this.mymap)
                markers = {
                    aircraft: aircraft,
                    info: info
                }
                this.markers[connectionId] = markers;
            }

            let popup = `Altitude: ${Math.floor(aircraftStatus.altitude)}<br />Airspeed: ${Math.floor(aircraftStatus.indicatedAirSpeed)}`;
            if (aircraftStatus.callsign) {
                popup = `<b>${aircraftStatus.callsign}</b><br />${popup}`;
            }

            markers.info.bindPopup(popup);
            (markers.info.getIcon() as L.DivIcon).options.className = connectionId == this.state.myConnectionId ? "divicon-aircraft-info me" : "divicon-aircraft-info";
            markers.info.setIcon(markers.info.getIcon());
            markers.aircraft
                .bindPopup(popup)
                .setRotationAngle(aircraftStatus.trueHeading);
        });

        hub.start();
    }

    private setTileLayer(type: MapTileType) {
        this.baseLayerGroup.clearLayers();
        switch (type) {
            case MapTileType.OpenStreetMap:
                this.baseLayerGroup.addLayer(L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
                    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery � <a href="https://www.mapbox.com/">Mapbox</a>',
                    maxZoom: 18,
                    id: 'mapbox/streets-v11',
                    tileSize: 512,
                    zoomOffset: -1,
                    accessToken: `${MAPBOX_API_KEY}`
                }));
                break;
            case MapTileType.OpenTopoMap:
                this.baseLayerGroup.addLayer(L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                    maxZoom: 17,
                    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                }));
                break;
            case MapTileType.EsriWorld:
                this.baseLayerGroup.addLayer(L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                }));
                break;
        }
    }

    private handleAircraftClick(connectionId: string, aircraftStatus: AircraftStatus) {
        if (this.mymap) {
            let latlng: L.LatLngExpression = [aircraftStatus.latitude, aircraftStatus.longitude];
            this.mymap.setView(latlng, this.mymap.getZoom());
        }
    }

    private handleOpenStreetMap() {
        this.setTileLayer(MapTileType.OpenStreetMap);
    }

    private handleOpenTopoMap() {
        this.setTileLayer(MapTileType.OpenTopoMap);
    }

    private handleEsriWorld() {
        this.setTileLayer(MapTileType.EsriWorld);
    }

    private handleMeChanged(connectionId: string | null) {
        this.setState({ myConnectionId: connectionId });
    }

    private handleFollowingChanged(connectionId: string | null) {
        this.setState({ followingConnectionId: connectionId });
    }

    render() {
        return <>
            <div id="mapid" style={{ height: '100%' }}></div>
            <LayerWrapper className="btn-group-vertical">
                <TileButton className="btn btn-light" onClick={this.handleOpenStreetMap}>OpenStreetMap</TileButton>
                <TileButton className="btn btn-light" onClick={this.handleOpenTopoMap}>OpenTopoMap</TileButton>
                <TileButton className="btn btn-light" onClick={this.handleEsriWorld}>Esri</TileButton>
            </LayerWrapper>
            <AircraftList aircrafts={this.state.aircrafts} onAircraftClick={this.handleAircraftClick}
                onMeChanged={this.handleMeChanged} myConnectionId={this.state.myConnectionId}
                onFollowingChanged={this.handleFollowingChanged} followingConnectionId={this.state.followingConnectionId} />
            <EventList />
        </>;
    }
}

const LayerWrapper = styled.div`
position: absolute;
top: 80px;
left: 10px;
z-index: 10000;
width: 140px;
box-shadow: 0 1px 5px rgba(0,0,0,0.65);
border-radius: 4px;

button {
    display: block;
}
`;

const TileButton = styled.button`
`