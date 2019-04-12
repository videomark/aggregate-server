# AggregateServer

AggregateServerは、サービス、地域(国、都道府県)、ISPごとに時、日で集計したQoE値の取得をするためのAPIサーバーです。

# 集計カテゴリ

-   サービス
    TVer, Paravi, YouTube など
-   地域
    -   国
        'JP' などの2文字のアルファベット
    -   都道府県
        13(東京) などのコード
-   ISP
    'Internet Initiative Japan'などのサービス名
-   時間
    -   日  日付
    -   時  時刻

# データ欠損について

サービス、国、都道府県、ISP データは欠損している可能性があります。

上記の欠損データは、通常のデータとして取り扱うため以下の値を欠損値とします。

| カテゴリ | 値       |
| ---- | ------- |
| サービス | unknown |
| 国    | --      |
| 都道府県 | 0       |
| ISP  | unknown |

# 使用フレームワーク

-   Express
-   MongoDB

# 動作確認環境

-   OS: Ubuntu 16.04
-   Node: v8.12.0

# 構成

    Web App   --->   nginx   --->  AggregateServer  --->  MongoDB

# 設定ファイル

設定ファイルは、jsonフォーマットです。config/default.jsonを書き換えることで変更することができます。 設定は、nodeのconfigモジュールを使用しています。起動時の環境変数を変更することで設定をオーバーライドすることができます。

<https://github.com/lorenwest/node-config>

    {
      "server": {
        "address": "127.0.0.1",                     <- 待受アドレス
        "port": 5889                                <- 待受ポート
      },
      "db": {
        "type": "mongodb",                          <- DBの種類(現在はMongoDB固定)
        "url": "mongodb://localhost:27017",         <- DBのURL
        "name": "sodium"                            <- DB名(現在はsodium固定)
        "limit": {                                  <- 検索数の上限
          "default": 20,
          "max": 100
        },
        "stats_collection": "stats_collection"      <- ステータス用のコレクション名
        "sodium_collection": "sodium_collection"    <- ロケーション、サービス名参照コレクション名
      }
      "file": {
        "city": "../location_data/GeoIP2-City.mmdb",    <- MaxmindのDBファイル
        "ISP": "../location_data/GeoIP2-ISP.mmdb"       <- MaxmindのDBファイル
      }
    }

# API

各APIの使用方法を説明します。特に明記しているもの以外は public API としていますが、不正なアクセスについてはフロントの nginx でフィルタします。

以下のAPIは `content-type: application/json` などで JSON フォーマットのデータをリクエストボディに含めてリクエストします。Web アプリ (JS コンテキスト) から呼び出す場合、適切に呼び出したときのみ `Access-Control-Allow-Origin` レスポンスヘッダなどが付与されることに注意してください。

## 全体統計 API

-   POST /stats

-   引数


        {
          "group"   : 文字列
          "country" : 文字列
          "limit"   : 整数値
          "sort"    : オブジェクト
        }

    -   group

        "hour" | "service" | "country" | "subdivision" | "isp" | 省略

        指定したグループごとに分けて集計した結果を返します。省略時は、何の分類もしない全データの平均です。
        但し、service, isp による絞り込みは private API となります。

    -   country

        対象とする国コード (jp)など

        groupに"subdivision"を指定したときの必須オプション

    -   limit

        返す要素の上限。省略時は 20 で上限 100 になります。

    -   sort

        ソートする要素の指定。要素をkeyにして　1 | -1　を指定する。

        ソートに対応している要素は、以下です。

        'count'、'max'、'min'、'average'、'total'

        |値 | ソート|
        ---|---
        |1 |ascending |
        |-1|descending|

        - 例1

           { "count": 1 }

        - 例2

           { "average": -1 }

-   戻り値

    groupで指定した要素の値、average、count、max、min、totalを返します。

    -   例

            {
              service: 'tver',
              average: 4.0649999999999995,
              count: 2,
              max: 4.1,
              min: 4.03,
              total: 8.129999999999999 },
            }

        groupで指定した結果の中に、対応した計測データが存在しない場合、その値は返しません。例えば、groupにhourを指定した場合、24時間までの値を返しますが、1-6時までの計測データがない場合、その時刻の値は返しません。最大で24個の配列になるが、それ以下の数の配列が戻る場合がある点に注意してください。

    -   エラーケース
        -   データがない場合、空の配列を返します。
        -   limitオプションが範囲外の値であった場合デフォルトの20が使用されます。
        -   sortオプションのフィールド名に、要素以外の値が指定されていた場合無視されます。また、値については、1以外の値は、-1として取り扱います。
        -   gorupにsubdivisionを指定してcountryに値を指定しない場合、400 Bad Request を返します。
        -   mongoDBが停止しているなどの理由で動作不能の状態に陥っている場合、500 Internal Server Error を返します。

## サービス別統計 API

この API は非公開 API です。自社サービスの品質改善などのため、この API で呼び出した結果の集計値が必要となる場合は個別にご相談ください。

-   POST /stats/service

-   引数

        {
          "service"   : 文字列
          "group"     : 文字列
        }

    -   service

        "YouTube" | "Paravi" | "TVer" | 省略

        グループ化集計するサービス名の指定 (大文字小文字区別せず、省略可)

    -   group

        "hour" | "day" | 省略

        グループ化集計する時間の単位を指定

-   戻り値

        [{
          service : サービス名
          data    : [
            {
              グループ化したフィールド    : 値
              count                     : 計測数
              max                       : 最大 QoE
              min                       : 最小 QoE
              average                   : 平均 QoE
              total                     : QoE 値の合計
            },
            ...]
        }]

    -   例 {"service": "youtube" , "group": "day"}


    ```
     [
        {
            "service": "youtube",
            "data": [
                {
                    "day": 1,
                    "min": 2.27,
                    "max": 4.79,
                    "average": 4.097142857142857,
                    "total": 143.4,
                    "count": 35
                },
                {
                    "day": 2,
                    "min": 1.92,
                    "max": 4.5,
                    "average": 3.6712000000000002,
                    "total": 91.78,
                    "count": 25
                },
                ...
            ]
        }
     ]
    ```

    -   エラーケース
        -   データがない場合、空の配列を返します。
        -   service、groupにが該当のもの以外を指定した場合、無視します。
        -   mongoDBが停止しているなどの理由で動作不能の状態に陥っている場合、500 Internal Server Error を返します。

## 国別統計 API

-   POST /stats/country

-   引数

        {
          "country"   : 文字列
          "group"     : 文字列
          "limit"     : 文字列
          "sort"      : 文字列
        }

    -   country

        グループ化集計する国コードの指定　"JP" など

    -   group

        "hour" | "day" | 省略

        グループ化集計する時間の単位を指定

    -   limit

        返す要素の上限。省略時は 20 で上限 100 になります。

    -   sort

        ソートする要素の指定。要素をkeyにして　1 | -1　を指定する。

        ソートに対応している要素は、以下です。

        'count'、'max'、'min'、'average'、'total'

        省略した場合、{ "count" : -1 } で動作します。


        |値 | ソート|
        ---|---
        |1 |ascending |
        |-1|descending|

        -   例1

             { "count": 1 }

        -   例2

             { "average": -1 }

-   戻り値

        [{
          country : 国コード
          data    : [
            {
              グループ化したフィールド    : 値
              count                     : 計測数
              max                       : 最大 QoE
              min                       : 最小 QoE
              average                   : 平均 QoE
              total                     : QoE 値の合計
            },
            ...]
        }]

    -   例 {"country": "jp" , "group": "day"}


    ```
    [{
        "country": "JP",
        "data": [
            {
                "day": 0,
                "min": 2.27,
                "max": 4.79,
                "average": 4.12421052631579,
                "total": 156.72,
                "count": 38
            },...{
                "day": 6,
                "min": 1.56,
                "max": 4.56,
                "average": 3.6508333333333334,
                "total": 87.62,
                "count": 24
            }
        ]
    }]
    ```

    -   エラーケース
        -   データがない場合、空の配列を返します。
        -   limitオプションが範囲外の値であった場合デフォルトの20が使用されます。
        -   sortオプションのフィールド名に、要素以外の値が指定されていた場合無視されます。また、値については、1以外の値は、-1として取り扱います。
        -   mongoDBが停止しているなどの理由で動作不能の状態に陥っている場合、500 Internal Server Error を返します。

## 地域別統計

-   POST /stats/subdivision

-   引数

        {
          "country"         : 文字列
          "subdivision"     : 文字列
          "group"           : 文字列
          "limit"           : 文字列
          "sort"            : 文字列
        }

    -   country

        グループ化集計する国コードの指定　"JP" など

    -   subdivision

        グループ化集計する地域コードの指定 "13"(東京) など

    -   group

        "hour" | "day" | 省略

        グループ化集計する時間の単位を指定

    -   limit

        返す要素の上限。省略時は 50 で上限 100 になります。

    -   sort

        ソートする要素の指定。要素をkeyにして　1 | -1　を指定する。

        ソートに対応している要素は、以下です。

        'count'、'max'、'min'、'average'、'total'

        省略した場合、{ "count" : -1 } で動作します。


        |値 | ソート|
        ---|---
        |1 |ascending |
        |-1|descending|

        -   例1

             { "count": 1 }

        -   例2

             { "average": -1 }

-   戻り値

        [{
          country       : 国コード
          subdivision   : 地域コード
          data    : [
            {
              グループ化したフィールド    : 値
              count                     : 計測数
              max                       : 最大 QoE
              min                       : 最小 QoE
              average                   : 平均 QoE
              total                     : QoE 値の合計
            },
            ...]
        }]

    -   例 {"country": "jp", "subdivision" : "13", "group": "day"}


    ```
    [{
        "country": "JP",
        "subdivision" : "13"
        "data": [
            {
                "day": 0,
                "min": 2.27,
                "max": 4.79,
                "average": 4.12421052631579,
                "total": 156.72,
                "count": 38
            },...{
                "day": 6,
                "min": 1.56,
                "max": 4.56,
                "average": 3.6508333333333334,
                "total": 87.62,
                "count": 24
            }
        ]
    }]
    ```

    -   エラーケース
        -   データがない場合、空の配列を返します。
        -   limitオプションが範囲外の値であった場合デフォルトの20が使用されます。
        -   sortオプションのフィールド名に、要素以外の値が指定されていた場合無視されます。また、値については、1以外の値は、-1として取り扱います。
        -   subdivisionを指定してcountryに値を指定しない場合、400 Bad Request を返します。subdivisionに数値以外の値を指定したときも同様です。
        -   mongoDBが停止しているなどの理由で動作不能の状態に陥っている場合、500 Internal Server Error を返します。

## ISP 別統計

この API は非公開 API です。自社サービスの品質改善などのため、この API で呼び出した結果の集計値が必要となる場合は個別にご相談ください。

-   POST /stats/isp

-   引数

        {
          "isp"       : 文字列
          "group"     : 文字列
          "limit"     : 文字列
          "sort"      : 文字列
        }

    -   isp

        グループ化集計するISP名の指定　"Softbank BB" など

    -   group

        "hour" | "day" | 省略

        グループ化集計する時間の単位を指定

    -   limit

        返す要素の上限。省略時は 20 で上限 100 になります。

    -   sort

        ソートする要素の指定。要素をkeyにして　1 | -1　を指定する。

        ソートに対応している要素は、以下です。

        'count'、'max'、'min'、'average'、'total'

        省略した場合、{ "count" : -1 } で動作します。


        |値 | ソート|
        ---|---
        |1 |ascending |
        |-1|descending|

        -   例1

             { "count": 1 }

        -   例2

             { "average": -1 }

-   戻り値

        [{
          isp : ISP名
          data    : [
            {
              グループ化したフィールド    : 値
              count                     : 計測数
              max                       : 最大 QoE
              min                       : 最小 QoE
              average                   : 平均 QoE
              total                     : QoE 値の合計
            },
            ...]
        }]

    -   例 {"isp": "Softbank BB" , "group": "day"}


    ```
    [{
        "isp": "Softbank BB",
        "data": [
            {
                "day": 0,
                "min": 2.27,
                "max": 4.79,
                "average": 4.12421052631579,
                "total": 156.72,
                "count": 38
            },...{
                "day": 6,
                "min": 1.56,
                "max": 4.56,
                "average": 3.6508333333333334,
                "total": 87.62,
                "count": 24
            }
        ]
    }]
    ```

    -   エラーケース
        -   データがない場合、空の配列を返します。
        -   limitオプションが範囲外の値であった場合デフォルトの20が使用されます。
        -   sortオプションのフィールド名に、要素以外の値が指定されていた場合無視されます。また、値については、1以外の値は、-1として取り扱います。
        -   mongoDBが停止しているなどの理由で動作不能の状態に陥っている場合、500 Internal Server Error を返します。

## 視聴位置とISP情報

クライアントに記録されているセッション・ビデオのペア ID を指定して、その視聴に関してサーバ側で推定した結果を取得する API です。

-   POST /stats/info

-   引数

        {
          "session"   : 文字列
          "video"     : 文字列
        }

    -   session

        視聴時のセッションID

    -   video

        視聴時のビデオID

-   戻り値

        [{
          "session"       : (string) 視聴時のセッションID
          "video"         : (string) 視聴時のビデオID
          "country"       : (string) 国コード | "--"
          "subdivision"   : (string) 地域コード | "0"
          "isp"           : (string) ISP名 | "unknown"
        }]
    - メンバーに推定結果を必ず含むオブジェクトの配列を返します。

    -   エラーケース
        -   データがない場合、空の配列を返します。
        -   mongoDBが停止しているなどの理由で動作不能の状態に陥っている場合、500 Internal Server Error を返します。

## 削除要求

クライアントに記録されているセッション・ビデオのペア ID を指定してその視聴に関するデータの恒久削除を要求する API です。

-   POST /ctrl/erasure

-   引数

        [{
          "session"   : 文字列
          "video"     : 文字列
        },...]

    -   session

        視聴時のセッションID

    -   video

        視聴時のビデオID

-   戻り値

        {
            "result": {
                "ok": <- 成功時は1
                "n":  <- 追加したペアIDの数
            }
        }

    -   エラーケース
        -   mongoDBが停止しているなどの理由で動作不能の状態に陥っている場合、500 Internal Server Error を返します。
        -   引数が配列ではない、もしくは、session, videoのエントリが見つからない場合、400 Bad Request を返します。

## アクティブセッション

現在計測中、QoE計算中のセッションの数を取得する API です。

-   GET /stats/active

-   引数

    -   なし

-   戻り値

        {
            "active": 計測中のセッション数
            "calculating": 計算中のセッション数
        }

    -   エラーケース
        -   mongoDBが停止しているなどの理由で動作不能の状態に陥っている場合、500 Internal Server Error を返します。

