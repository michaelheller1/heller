import dash
from dash import html

app = dash.Dash(__name__)

app.layout = html.Div([
    html.H1("Simple Dashboard"),
    html.P("Welcome to your dashboard!"),
    html.Button("Add", id="add-button")
])

if __name__ == '__main__':
    app.run_server(debug=True)